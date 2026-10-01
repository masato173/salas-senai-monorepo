import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { resolveCorsOrigins } from '../../common/cors-origins.util';

// Room de quem aprova reservas (COORDENADOR + ADMIN). Recebe os eventos
// completos de reserva de todo mundo — o painel de Aprovações e os dots da
// sidebar dependem disso (Aprovacoes/index.tsx não tem polling).
export const COORDINATORS_ROOM = 'coordenadores';

// Namespace /rooms — auth JWT no handshake (F4.10b).
// Cliente envia token em: io('/rooms', { auth: { token: accessToken } })
// Conexões sem token válido são desconectadas antes de receber eventos.
//
// CORS configurável via CORS_ORIGIN (Fase C3 — antes era hardcoded só pra
// localhost, quebraria em produção com o frontend real no GitHub Pages).
// Mesma função de main.ts (resolveCorsOrigins), não duplica o fallback.
//
// TIMING (investigado nesta sessão, não é suposição): a opção `cors` deste
// decorator é avaliada em IMPORT TIME (quando este arquivo é carregado),
// antes do NestJS terminar de subir a aplicação — mais cedo que a fase de
// DI onde o ConfigModule normalmente resolveria variáveis via
// ConfigService. Funciona hoje porque:
//   1. ConfigModule (apps/api/src/modules/config/config.module.ts) chama
//      NestConfigModule.forRoot({...}) dentro do próprio @Module() — isso
//      roda dotenv.config() de forma SÍNCRONA assim que config.module.ts é
//      importado (não espera o bootstrap do Nest).
//   2. ConfigModule é o PRIMEIRO import em app.module.ts, bem antes de
//      RealtimeModule — CommonJS resolve imports em ordem, então .env já
//      está em process.env quando este arquivo (e o decorator abaixo) roda.
//   3. Em produção (Railway), isso nem importa: a plataforma injeta env vars
//      em process.env antes do processo Node existir, independente de
//      ordem de import.
// Fragilidade real, mas não um bug hoje: se a ordem de imports em
// app.module.ts mudar (RealtimeModule antes de ConfigModule), isso
// quebraria em dev local — o fallback de localhost ainda cobre esse caso,
// então não é crítico. Não implementei nada mais robusto sem evidência de
// que isso realmente quebra hoje.
@WebSocketGateway({
  namespace: '/rooms',
  cors: {
    origin: resolveCorsOrigins(),
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.['token'] as string | undefined;

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      client.data = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      // Fase C2 — room nomeada com o próprio userId: permite emitir
      // notificação DIRECIONADA (server.to(userId).emit(...)) sem broadcast
      // global. join() retorna Promise<void> | void dependendo do adapter
      // (confirmado no .d.ts do socket.io instalado) — não precisamos
      // aguardar, só evitar floating promise.
      void client.join(payload.sub);
      // Room por role: só quem aprova recebe os eventos de reserva alheia.
      if (payload.role === 'COORDENADOR' || payload.role === 'ADMIN') {
        void client.join(COORDINATORS_ROOM);
      }
    } catch {
      // Token inválido ou expirado — desconecta sem vazar detalhes do erro
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket): void {
    // No-op — nenhum cleanup manual de room necessário. Confirmado lendo o
    // código-fonte do socket.io instalado (socket.js): o fluxo interno de
    // disconnect chama _cleanup() -> leaveAll(), removendo o socket de
    // TODAS as rooms (inclusive a room de userId da Fase C2) antes mesmo
    // do evento "disconnect" ser emitido — não é suposição, é o
    // comportamento real do pacote.
  }
}
