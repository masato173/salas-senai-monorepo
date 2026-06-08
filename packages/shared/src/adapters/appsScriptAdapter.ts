import { AppError } from '../errors/AppError';
import { toNormalizedPayload } from '../mappers/registroMapper';
import type { NormalizedPayload } from '../dto/registroDTO';

interface AdapterConfig {
  url:   string;
  token: string;
}

interface AppsScriptAdapter {
  fetchAndNormalize: () => Promise<NormalizedPayload>;
}

/**
 * Adapter para o Apps Script + Google Sheets.
 *
 * Responsabilidades:
 * 1. Fazer o fetch com token
 * 2. Detectar erros do Apps Script ({ error: '...' })
 * 3. Delegar normalização ao toNormalizedPayload()
 *
 * Ponto de integração entre o legado e a nova arquitetura.
 * O restante do sistema só conhece NormalizedPayload — nunca
 * o payload raw do Apps Script.
 */
export function createAppsScriptAdapter(config: AdapterConfig): AppsScriptAdapter {
  return {
    async fetchAndNormalize(): Promise<NormalizedPayload> {
      const url = `${config.url}?token=${encodeURIComponent(config.token)}`;

      let raw: unknown;
      try {
        const res = await fetch(url);
        raw = await res.json();
      } catch (cause) {
        throw AppError.api(
          'Falha ao conectar com o servidor de dados.',
          cause,
        );
      }

      // Apps Script retorna { error: '...' } para erros internos
      if (
        raw !== null &&
        typeof raw === 'object' &&
        'error' in (raw as object) &&
        typeof (raw as Record<string, unknown>).error === 'string'
      ) {
        throw AppError.api('Falha ao carregar dados.');
      }

      // toNormalizedPayload lança AppError.parse se estrutura inválida
      return toNormalizedPayload(raw);
    },
  };
}
