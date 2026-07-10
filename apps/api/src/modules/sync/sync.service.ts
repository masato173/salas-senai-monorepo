import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

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

export interface SyncResult {
  synced: number;
  timestamp: string;
}

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async syncSchedules(): Promise<SyncResult> {
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

    // Full replace: DELETE + INSERT em $transaction
    await this.prisma.$transaction(async tx => {
      await tx.schedule.deleteMany({});
      if (dados.length > 0) {
        await tx.schedule.createMany({
          data: dados.map(d => ({
            date: d.data,
            sala: d.sala,
            turma: d.turma,
            mes: d.mes,
            turno: d.turno ?? null,
          })),
        });
      }
    });

    return {
      synced: dados.length,
      timestamp: new Date().toISOString(),
    };
  }
}
