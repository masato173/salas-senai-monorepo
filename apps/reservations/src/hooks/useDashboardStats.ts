import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export interface DashboardStats {
  date: string;
  totalSalas: number;
  salasComAula: number;
  salasLivres: number;
  aulasHoje: number;
  reservasHoje: number;
  reservasPendentes: number;
  reservasAprovadas: number;
  ocupacaoPercent: number;
  porTurno: { M: number; V: number; N: number };
  geradoEm: string;
}

export async function fetchDashboardStats(
  date: string,
  apiBase: string = API_BASE,
): Promise<DashboardStats> {
  const url = `${apiBase}/dashboard?date=${date}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erro ao buscar stats do dashboard: HTTP ${response.status}`);
  }
  return response.json() as Promise<DashboardStats>;
}

interface HookResult {
  data: DashboardStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface HookOptions {
  enabled?: boolean;
  autoFetch?: boolean;
}

export function useDashboardStats(date: string, options: HookOptions = {}): HookResult {
  const { enabled = true, autoFetch = true } = options;
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const doFetch = useCallback((): void => {
    if (!enabled) return;
    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    fetchDashboardStats(date)
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
  }, [date, enabled]);

  useEffect(() => {
    if (!autoFetch) return;
    doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doFetch encapsula date e enabled
  }, [date, enabled]);

  return { data, loading, error, refetch: doFetch };
}
