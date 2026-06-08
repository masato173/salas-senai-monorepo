import type { ApiResponse } from '../types';

interface ApiConfig {
  url:   string;
  token: string;
}

interface ApiClient {
  fetchData: () => Promise<ApiResponse>;
}

/**
 * Factory de cliente da API do Apps Script.
 *
 * Por que factory? Para injetar config nos testes sem
 * variáveis de ambiente e sem estado global.
 */
export function createApiClient(config: ApiConfig): ApiClient {
  return {
    async fetchData(): Promise<ApiResponse> {
      const url    = `${config.url}?token=${encodeURIComponent(config.token)}`;
      const res    = await fetch(url);
      const data   = await res.json() as Partial<ApiResponse> & { error?: string };

      // Apps Script retorna { error: '...' } quando há falha interna
      if (data.error) {
        throw new Error('Falha ao carregar dados.');
      }

      return {
        ok:       data.ok       ?? false,
        total:    data.total    ?? 0,
        dados:    data.dados    ?? [],
        turnoMap: data.turnoMap ?? {},
      };
    },
  };
}
