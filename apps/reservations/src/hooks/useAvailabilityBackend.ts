import { useState, useEffect, useRef, useCallback } from 'react';
import type { AvailabilityResult, Turno } from '../types';

// URL base do backend NestJS — sobreposta por VITE_API_URL no .env.local.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Feature flag compilada em build-time pelo Vite.
// Ligar: VITE_BACKEND_DRIVER=true no .env.local.
// Desligar (padrão): variável ausente ou valor diferente de 'true'.
export const BACKEND_DRIVER_ENABLED: boolean = import.meta.env.VITE_BACKEND_DRIVER === 'true';

// Função pura — testável em isolamento sem React.
// Faz GET /availability?date=YYYY-MM-DD[&turno=M|V|N]
// Lança em HTTP não-OK ou falha de rede.
export async function fetchAvailability(
  params: { date: string; turno?: Turno | undefined },
  apiBase: string = API_BASE,
): Promise<AvailabilityResult> {
  const query = new URLSearchParams({ date: params.date });
  if (params.turno !== undefined) query.set('turno', params.turno);
  const url = `${apiBase}/availability?${query.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erro ao buscar disponibilidade: HTTP ${response.status}`);
  }
  return response.json() as Promise<AvailabilityResult>;
}

interface HookResult {
  data: AvailabilityResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface HookOptions {
  // enabled=false desabilita fetch (ex: feature flag desligada).
  enabled?: boolean | undefined;
  // autoFetch=false desabilita fetch automático (ex: testes).
  autoFetch?: boolean | undefined;
}

// Hook assíncrono — Forma A (faz fetch).
// Diferente de useAvailability (Forma B, derivado, síncrono) — NÃO os confundir.
// O orquestrador escolhe qual usar baseado em BACKEND_DRIVER_ENABLED.
export function useAvailabilityBackend(
  date: string,
  turno: Turno | undefined,
  options: HookOptions = {},
): HookResult {
  const { enabled = true, autoFetch = true } = options;
  const [data, setData] = useState<AvailabilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // fetchId evita race condition: descarta resposta de fetch obsoleto.
  const fetchIdRef = useRef(0);

  const doFetch = useCallback((): void => {
    if (!enabled) return;
    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    fetchAvailability({ date, turno })
      .then(result => {
        if (id === fetchIdRef.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (id === fetchIdRef.current) {
          setError(e instanceof Error ? e.message : 'Erro desconhecido');
          setLoading(false);
        }
      });
  }, [date, enabled, turno]);

  useEffect(() => {
    if (!autoFetch) return;
    doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intencional: doFetch encapsula date, turno e enabled.
    // refetch() é o mecanismo explícito para nova busca.
  }, [date, turno, enabled]);

  return { data, loading, error, refetch: doFetch };
}
