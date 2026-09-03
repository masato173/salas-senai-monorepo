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

  private postJsonOnce(
    targetUrl: string,
    payload: string,
  ): Promise<{ status: number; location: string | null; body: string }> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        new URL(targetUrl),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        res => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', chunk => {
            body += chunk;
          });
          res.on('end', () => {
            resolve({
              status: res.statusCode ?? 0,
              location: res.headers.location ?? null,
              body,
            });
          });
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  // Apps Script Web Apps sempre respondem /exec com 302 pra
  // script.googleusercontent.com (é lá que o script de fato executa).
  // fetch nativo demove POST pra GET e descarta o body ao seguir esse
  // redirect automaticamente (WHATWG fetch spec); redirect:'manual' no
  // fetch do Node não resolve, porque undici retorna um "opaque redirect"
  // (status 0, headers ilegíveis) nesse modo — igual um browser. Por isso
  // usamos https.request direto e reenviamos o mesmo POST pra URL do
  // Location manualmente.
  private async postToAppsScript(url: string, payload: string): Promise<string> {
    let currentUrl = url;
    for (let hop = 0; hop < 5; hop++) {
      const { status, location, body } = await this.postJsonOnce(currentUrl, payload);
      if (status >= 300 && status < 400) {
        if (!location) {
          throw new Error(`Apps Script redirecionou (status ${status}) sem header Location.`);
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      return body;
    }
    throw new Error('Apps Script excedeu o limite de redirecionamentos ao sincronizar.');
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
        const body = await this.postToAppsScript(
          url,
          JSON.stringify({ action: 'listSchedules', token }),
        );
        raw = JSON.parse(body) as AppsScriptResponse;
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
