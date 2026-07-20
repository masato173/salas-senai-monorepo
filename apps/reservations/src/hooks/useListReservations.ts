import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ListReservationsOptions,
  ListReservationsResponse,
  BackendError,
} from '../services/apiTypes';

// ─────────────────────────────────────────────────────────────
// Política de retry — apenas para falhas transientes.
// Retenta APENAS:
//   - falha de rede (fetch lança)
//   - envelope ok=false com error.code === 'INTERNAL'
// NUNCA retenta NOT_FOUND, FORBIDDEN, VALIDATION, LOCK_TIMEOUT,
// DUPLICATE, CONFLICT (não viram sucesso por tentar de novo).
//
// Espelha o padrão de useCreateReservation / useCreateReservationRange.
// Tech-debt conhecida: lógica de retry duplicada — generalizar em cleanup futuro.
// ─────────────────────────────────────────────────────────────

interface ReservationLister {
  listReservations: (options?: ListReservationsOptions) => Promise<ListReservationsResponse>;
}

interface ExecuteOptions {
  maxRetries?: number; // default 2
}

export async function executeListReservations(
  service: ReservationLister,
  options?: ListReservationsOptions,
  executeOptions: ExecuteOptions = {},
): Promise<ListReservationsResponse> {
  const maxRetries = executeOptions.maxRetries ?? 2;

  let lastEnvelope: ListReservationsResponse | undefined;
  let lastNetError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await service.listReservations(options);
      if (res.ok || !isRetryable(res.error?.code)) {
        return res;
      }
      lastEnvelope = res;
    } catch (err) {
      lastNetError = err;
    }
  }

  if (lastEnvelope) return lastEnvelope;
  throw lastNetError;
}

function isRetryable(code: BackendError['code'] | undefined): boolean {
  return code === 'INTERNAL';
}

// ─────────────────────────────────────────────────────────────
// Hook React — query (não mutation): expõe refetch, não mutate.
// autoFetch=true (default) dispara fetch no mount via useEffect.
// ─────────────────────────────────────────────────────────────

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseListReservationsOptions {
  autoFetch?: boolean; // default true — caller desliga em testes / strict-mode / quotas
}

interface UseListReservationsResult {
  data: ListReservationsResponse['data'];
  status: QueryStatus;
  error: BackendError | null;
  refetch: (options?: ListReservationsOptions) => Promise<ListReservationsResponse>;
}

export function useListReservations(
  service: ReservationLister,
  hookOptions: UseListReservationsOptions = {},
): UseListReservationsResult {
  const { autoFetch = true } = hookOptions;

  const [status, setStatus] = useState<QueryStatus>('idle');
  const [error, setError] = useState<BackendError | null>(null);
  const [data, setData] = useState<ListReservationsResponse['data']>(null);

  const serviceRef = useRef(service);
  serviceRef.current = service;

  const refetch = useCallback(async (options?: ListReservationsOptions) => {
    setStatus('loading');
    setError(null);

    try {
      const res = await executeListReservations(serviceRef.current, options);
      if (res.ok) {
        setData(res.data);
        setStatus('success');
      } else {
        setError(res.error);
        setStatus('error');
      }
      return res;
    } catch (err) {
      const networkError: BackendError = {
        code: 'INTERNAL',
        message: err instanceof Error ? err.message : 'Falha de rede.',
      };
      setError(networkError);
      setStatus('error');
      return { ok: false, data: null, error: networkError };
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
