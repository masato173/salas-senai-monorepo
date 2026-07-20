import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScheduleResult } from '../services/apiTypes';

// ─────────────────────────────────────────────────────────────
// Sprint A3.1 — hook de dados pro Dashboard nativo.
// Migra a fonte de ocupação que hoje vive no iframe legado.
//
// ⚠️ DIFERENÇA-CHAVE vs useListReservations.ts (molde):
// fetchSchedule() NÃO retorna envelope { ok, data, error }. Retorna
// ScheduleResult direto e LANÇA (throw) em erro (`if (data.error) throw`
// dentro do service). Implicações no retry:
//   • Não há isRetryable por código — não existe envelope a inspecionar.
//   • Retentar em QUALQUER exceção (tratada como transiente).
//   • Esgotar retries → re-lança a última exceção.
//
// Mantém: serviceRef pra capturar service atual sem stale closure;
// useEffect mount-only com autoFetch; QueryStatus state machine.
// ─────────────────────────────────────────────────────────────

interface ScheduleProvider {
  fetchSchedule: () => Promise<ScheduleResult>;
}

interface ExecuteOptions {
  maxRetries?: number; // default 2
}

export async function executeFetchSchedule(
  service: ScheduleProvider,
  executeOptions: ExecuteOptions = {},
): Promise<ScheduleResult> {
  const maxRetries = executeOptions.maxRetries ?? 2;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await service.fetchSchedule();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────────────────
// Hook React — query (refetch, não mutate). autoFetch no mount.
// ─────────────────────────────────────────────────────────────

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseScheduleOptions {
  autoFetch?: boolean; // default true — caller desliga em testes / strict-mode
}

interface UseScheduleResult {
  data: ScheduleResult | null;
  status: QueryStatus;
  // String simples (não há BackendError aqui — fetchSchedule lança Error puro).
  error: string | null;
  refetch: () => Promise<ScheduleResult | null>;
}

export function useSchedule(
  service: ScheduleProvider,
  hookOptions: UseScheduleOptions = {},
): UseScheduleResult {
  const { autoFetch = true } = hookOptions;

  const [status, setStatus] = useState<QueryStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScheduleResult | null>(null);

  const serviceRef = useRef(service);
  serviceRef.current = service;

  const refetch = useCallback(async (): Promise<ScheduleResult | null> => {
    setStatus('loading');
    setError(null);

    try {
      const result = await executeFetchSchedule(serviceRef.current);
      setData(result);
      setStatus('success');
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados.');
      setStatus('error');
      return null;
    }
  }, []);

  useEffect(() => {
    if (autoFetch) void refetch();
    // Mount-only: intencionalmente sem deps de service/options.
    // Se service mudar, caller chama refetch explicitamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, status, error, refetch };
}
