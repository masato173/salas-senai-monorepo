import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as https from 'node:https';
import type { SyncResult } from '@salas-senai/shared';

interface AppsScriptDadoItem {
  data: string;
  sala: string;
  turma: string;
  mes: string;
  turno?: string | null;
}

interface AppsScriptResponse {
  ok?: boolean;
  error?: string;
  dados?: AppsScriptDadoItem[];
}

// SyncResult agora vem de @salas-senai/shared — removido daqui

interface AppsScriptHttpResult {
  status: number;
  location: string | null;
  contentType: string | null;
  body: string;
}

// ADR-008 — redirecionamento do Apps Script.
// Máximo de redirecionamentos seguidos (o fluxo normal usa 1: /exec → echo).
const APPS_SCRIPT_MAX_REDIRECTS = 5;
// Prazo total da busca, somando todos os saltos. O listSchedules lê ~1500
// linhas da planilha (poucos segundos + cold start do Apps Script); 60 s dá
// folga e, sobretudo, garante que o lock isRunning seja liberado se o
// Google não responder (sem prazo, todo sync seguinte receberia 409).
const APPS_SCRIPT_TIMEOUT_MS = 60_000;
// 301/302/303 → a próxima requisição é GET sem corpo; 307/308 mantêm
// método e corpo (regra HTTP). Outros 3xx não são seguidos.
const FOLLOW_AS_GET: ReadonlySet<number> = new Set([301, 302, 303]);
const FOLLOW_KEEP_METHOD: ReadonlySet<number> = new Set([307, 308]);
// Destinos de redirecionamento aceitos: só https e domínios do Google
// (script.google.com → script.googleusercontent.com). A URL inicial vem do
// .env (APPS_SCRIPT_URL) e não passa por aqui.
const REDIRECT_ALLOWED_HOSTS = ['google.com', 'googleusercontent.com'] as const;

export function isAllowedRedirectTarget(url: URL): boolean {
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return REDIRECT_ALLOWED_HOSTS.some(allowed => host === allowed || host.endsWith(`.${allowed}`));
}

@Injectable()
export class SyncService {
  // Lock in-memory — evita execuções simultâneas.
  // Single-instance: suficiente para ambiente atual.
  // Multi-instance requereria lock no banco.
  private readonly logger = new Logger(SyncService.name);
  private static isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // Uma requisição. Só manda corpo (e Content-Type/Content-Length) quando
  // há payload — o GET do link do resultado vai sem nada.
  private requestOnce(
    url: URL,
    method: 'GET' | 'POST',
    payload: string | null,
    signal: AbortSignal,
  ): Promise<AppsScriptHttpResult> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        url,
        {
          method,
          signal,
          ...(payload !== null
            ? {
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(payload),
                },
              }
            : {}),
        },
        res => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', chunk => {
            body += chunk;
          });
          res.on('error', reject);
          res.on('end', () => {
            resolve({
              status: res.statusCode ?? 0,
              location: res.headers.location ?? null,
              contentType: res.headers['content-type'] ?? null,
              body,
            });
          });
        },
      );
      req.on('error', reject);
      // Garante que a promessa termina no prazo mesmo se o abort chegar
      // durante a leitura do corpo (quando o req pode não emitir 'error').
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      if (payload !== null) req.write(payload);
      req.end();
    });
  }

  // ADR-008 — o Apps Script EXECUTA no primeiro POST em /exec e responde 302
  // com o link do resultado (script.googleusercontent.com/macros/echo?...).
  // Esse link se busca com GET, sem corpo: é a regra HTTP de 301/302/303
  // (307/308 mantêm método e corpo). Reenviar o POST ao Location — o que
  // este código fazia — devolve uma página HTML de erro do Google, e o sync
  // quebrava no JSON.parse. Por isso o laço é manual (https.request): segue
  // a regra acima, recusa destinos fora do Google, limita os saltos e impõe
  // um prazo total. O token só vai no corpo do primeiro POST (e de um
  // eventual 307/308, sempre para host permitido).
  private async fetchFromAppsScript(url: string, payload: string): Promise<AppsScriptHttpResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), APPS_SCRIPT_TIMEOUT_MS);
    try {
      let currentUrl = new URL(url);
      let method: 'GET' | 'POST' = 'POST';
      let body: string | null = payload;
      for (let redirects = 0; ; redirects++) {
        const res = await this.requestOnce(currentUrl, method, body, controller.signal);
        const followAsGet = FOLLOW_AS_GET.has(res.status);
        if (!followAsGet && !FOLLOW_KEEP_METHOD.has(res.status)) return res;

        if (!res.location) {
          throw new Error(`Apps Script redirecionou (status ${res.status}) sem header Location.`);
        }
        if (redirects >= APPS_SCRIPT_MAX_REDIRECTS) {
          throw new Error(
            `Apps Script: redirecionamentos demais (limite ${APPS_SCRIPT_MAX_REDIRECTS}).`,
          );
        }
        const next = new URL(res.location, currentUrl);
        if (!isAllowedRedirectTarget(next)) {
          // Só protocolo e host — a URL inteira pode carregar chaves de acesso.
          throw new Error(
            `Apps Script redirecionou para destino não permitido (${next.protocol}//${next.hostname}).`,
          );
        }
        if (followAsGet) {
          method = 'GET';
          body = null;
        }
        currentUrl = next;
      }
    } catch (e) {
      if (controller.signal.aborted) {
        throw new Error(`Apps Script não respondeu em ${APPS_SCRIPT_TIMEOUT_MS / 1000} s.`);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  // Status fora de 2xx ou corpo não-JSON → erro com status e content-type,
  // nunca com o corpo (pode ecoar dados da requisição). Lança antes do
  // DELETE: o Schedule nunca é substituído por causa de uma página de erro.
  private parseAppsScriptJson(res: AppsScriptHttpResult): AppsScriptResponse {
    const descricao = `status ${res.status}, content-type ${res.contentType ?? 'ausente'}`;
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Apps Script respondeu com erro (${descricao}).`);
    }
    try {
      return JSON.parse(res.body) as AppsScriptResponse;
    } catch {
      throw new Error(`Apps Script respondeu conteúdo que não é JSON (${descricao}).`);
    }
  }

  async syncSchedules(userId: string): Promise<SyncResult> {
    if (SyncService.isRunning) {
      throw new ConflictException(
        'Sincronização já está em andamento. Aguarde a conclusão e tente novamente.',
      );
    }
    SyncService.isRunning = true;
    const syncId = randomUUID();
    this.logger.log(`Sync iniciado (syncId: ${syncId}, userId: ${userId}).`);
    const startedAt = new Date().toISOString();
    const startMs = Date.now();
    try {
      const url = this.config.get<string>('APPS_SCRIPT_URL');
      const token = this.config.get<string>('APPS_SCRIPT_TOKEN');

      if (!url || !token) {
        throw new InternalServerErrorException(
          'APPS_SCRIPT_URL e APPS_SCRIPT_TOKEN devem ser configurados no .env.',
        );
      }

      // Fetch do Apps Script — token vai no corpo da requisição, nunca na URL
      // (query string vaza em logs de proxy/servidor e no header Referer).
      let raw: AppsScriptResponse;
      try {
        const res = await this.fetchFromAppsScript(
          url,
          JSON.stringify({ action: 'listSchedules', token }),
        );
        raw = this.parseAppsScriptJson(res);
      } catch (e) {
        throw new InternalServerErrorException(
          `Falha ao buscar dados do Apps Script: ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      if (raw.error) {
        throw new InternalServerErrorException(`Apps Script retornou erro: ${raw.error}`);
      }

      const dados = raw.dados ?? [];

      // Guard: Apps Script retornou lista vazia — abortar antes do DELETE.
      // Isso protege os dados históricos de um retorno vazio acidental
      // (Apps Script desativado, timeout, ou planilha sem dados no futuro).
      // Um sync vazio não é um erro de negócio, mas também não justifica
      // apagar a tabela Schedule inteira.
      if (dados.length === 0) {
        const finishedAt = new Date().toISOString();
        const duration = Date.now() - startMs;
        this.logger.warn(
          `Sync abortado (syncId: ${syncId}): Apps Script retornou 0 registros. ` +
            'Schedule não foi alterado. Verifique se o Apps Script está ativo e a planilha tem dados.',
        );
        return {
          synced: 0,
          fromAppsScript: 0,
          duration,
          syncId,
          startedAt,
          finishedAt,
          timestamp: finishedAt,
        };
      }

      // Full replace: DELETE + INSERT sequenciais sem $transaction interativo.
      // pgbouncer em transaction mode não suporta interactive transactions para
      // operações longas. Sync é idempotente — retry resolve falha parcial.
      await this.prisma.schedule.deleteMany({});
      // createMany em lotes de 500 evita timeout de query individual
      const BATCH = 500;
      for (let i = 0; i < dados.length; i += BATCH) {
        await this.prisma.schedule.createMany({
          data: dados.slice(i, i + BATCH).map(d => ({
            date: d.data,
            sala: d.sala,
            turma: d.turma,
            mes: d.mes,
            turno: d.turno ?? null,
            inicio:
              d.turno === 'M'
                ? '07:00'
                : d.turno === 'V'
                  ? '13:00'
                  : d.turno === 'N'
                    ? '18:00'
                    : null,
            fim:
              d.turno === 'M'
                ? '12:30'
                : d.turno === 'V'
                  ? '18:00'
                  : d.turno === 'N'
                    ? '22:00'
                    : null,
          })),
        });
      }

      // Contar registros realmente inseridos — diagnóstico e retorno real
      const inserted = await this.prisma.schedule.count();
      const finishedAt = new Date().toISOString();
      const duration = Date.now() - startMs;

      const result: SyncResult = {
        synced: inserted,
        fromAppsScript: dados.length,
        duration,
        syncId,
        startedAt,
        finishedAt,
        timestamp: finishedAt, // backward-compat
      };

      // Auditoria — sequencial, fora de $transaction (Bug #2 do MEMORY.md)
      await this.prisma.auditLog.create({
        data: {
          action: 'SYNC_SCHEDULES',
          entityType: 'Schedule',
          entityId: syncId,
          userId,
          before: Prisma.JsonNull,
          after: {
            synced: inserted,
            fromAppsScript: dados.length,
            duration,
            syncId,
            startedAt,
            finishedAt,
          } as Prisma.InputJsonValue,
        },
      });

      return result;
    } finally {
      SyncService.isRunning = false;
    }
  }
}
