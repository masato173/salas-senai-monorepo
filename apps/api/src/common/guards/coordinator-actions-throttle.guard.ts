import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerException,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';

// Issue 6 / ADR-006 — limite de requisições do COORDENADOR nas ações sobre
// reservas: editar, cancelar, aprovar/rejeitar, lote por grupo e por seleção.
//
// Por que um guard de rota (e não um throttler nomeado no ThrottlerModule):
// o ThrottlerGuard global roda ANTES do JwtAuthGuard (ordem do APP_GUARD em
// app.module.ts), então lá o req.user ainda não existe. Guards de rota rodam
// DEPOIS dos globais — aqui o req.user já foi populado pela JwtStrategy, com
// o papel vindo do banco. A ordem global não muda.
//
// - Só COORDENADOR é limitado; ADMIN e PROFESSOR seguem só no global (100/min/IP).
// - Tracker = userId (não IP). Balde ÚNICO para as 5 rotas: a chave não
//   inclui o handler (o generateKey padrão do throttler é por handler).
// - Cada requisição conta 1, inclusive as em lote.
// - Mesmo skipIf do módulo (THROTTLE_SKIP, issue 7 — proibido em produção).
// - Storage em memória do ThrottlerModule: o limite é POR INSTÂNCIA da api.

/** Nome do throttler no storage (separa os contadores do 'default' global). */
export const COORDINATOR_ACTIONS_THROTTLER = 'coordenador-acoes';
/** Máximo de ações por coordenador dentro da janela. */
export const COORDINATOR_ACTIONS_LIMIT = 30;
/** Janela do limite (e duração do bloqueio), em ms. */
export const COORDINATOR_ACTIONS_TTL_MS = 60_000;
/** Mensagem do 429 — o frontend exibe o `message` do backend. */
export const COORDINATOR_ACTIONS_MESSAGE =
  'Limite de ações de coordenador atingido (30 por minuto). Aguarde um minuto e tente novamente.';

interface ThrottledRequest {
  ip?: string;
  user?: { userId: string; role: string };
}

interface ThrottledResponse {
  header: (name: string, value: number) => unknown;
}

/** userId quando autenticado; IP como fallback defensivo. */
export function resolveCoordinatorActionsTracker(req: ThrottledRequest): string {
  return req.user ? `user:${req.user.userId}` : `ip:${req.ip ?? 'desconhecido'}`;
}

@Injectable()
export class CoordinatorActionsThrottleGuard implements CanActivate {
  constructor(
    @InjectThrottlerOptions() private readonly options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!Array.isArray(this.options) && this.options.skipIf?.(context) === true) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<ThrottledRequest>();
    if (req.user?.role !== 'COORDENADOR') return true;

    const key = `${COORDINATOR_ACTIONS_THROTTLER}:${resolveCoordinatorActionsTracker(req)}`;
    const { isBlocked, timeToBlockExpire } = await this.storage.increment(
      key,
      COORDINATOR_ACTIONS_TTL_MS,
      COORDINATOR_ACTIONS_LIMIT,
      COORDINATOR_ACTIONS_TTL_MS, // blockDuration = ttl
      COORDINATOR_ACTIONS_THROTTLER,
    );

    if (isBlocked) {
      http.getResponse<ThrottledResponse>().header('Retry-After', timeToBlockExpire); // segundos
      throw new ThrottlerException(COORDINATOR_ACTIONS_MESSAGE);
    }
    return true;
  }
}
