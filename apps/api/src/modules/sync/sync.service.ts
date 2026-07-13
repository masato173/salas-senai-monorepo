import { Injectable, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
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
  private static isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async syncSchedules(userId: string): Promise<SyncResult> {
    if (SyncService.isRunning) {
      throw new ConflictException(
        'Sincronização já está em andamento. Aguarde a conclusão e tente novamente.',
      );
    }
    SyncService.isRunning = true;
    const syncId = randomUUID();
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

      // Fetch do Apps Script (mesmo formato consumido pelo frontend)
      const fetchUrl = `${url}?token=${encodeURIComponent(token)}`;
      let raw: AppsScriptResponse;
      try {
        const res = await fetch(fetchUrl);
        raw = (await res.json()) as AppsScriptResponse;
      } catch (e) {
        throw new InternalServerErrorException(
          `Falha ao buscar dados do Apps Script: ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      if (raw.error) {
        throw new InternalServerErrorException(`Apps Script retornou erro: ${raw.error}`);
      }

      const dados = raw.dados ?? [];

      // Full replace: DELETE + INSERT sequenciais sem $transaction interativo.
      // pgbouncer em transaction mode não suporta interactive transactions para
      // operações longas. Sync é idempotente — retry resolve falha parcial.
      await this.prisma.schedule.deleteMany({});
      if (dados.length > 0) {
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
            })),
          });
        }
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
