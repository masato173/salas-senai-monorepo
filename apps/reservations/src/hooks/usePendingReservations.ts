import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackendError, ListReservationsResponse } from '../services/appsScript';

// ─────────────────────────────────────────────────────────────
// usePendingReservations — F6.1
//
// Busca reservas via service.listPendingReservations().
// Filtros preparados para crescimento — F6.1 usa status='PENDING'.
// professor/sala/data preparados para uso futuro (server ou client-side).
//
// Padrão idêntico ao useListReservations: { data, status, error, refetch }.
// ─────────────────────────────────────────────────────────────

export interface PendingReservationsFilters {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  professor?: string; // client-side em F6.1
  sala?: string; // futuro: roomId=
  data?: string; // futuro: date=
}

interface PendingReservationsFetcher {
  listPendingReservations(filters?: PendingReservationsFilters): Promise<ListReservationsResponse>;
}

type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

interface UsePendingReservationsResult {
  data: ListReservationsResponse['data'];
  status: QueryStatus;
  error: BackendError | null;
  refetch: () => Promise<ListReservationsResponse>;
}

export interface UsePendingReservationsOptions {
  autoFetch?: boolean;
}

export async function executeListPendingReservations(
  service: PendingReservationsFetcher,
  filters?: PendingReservationsFilters,
): Promise<ListReservationsResponse> {
  return service.listPendingReservations(filters);
}

export function usePendingReservations(
  service: PendingReservationsFetcher,
  filters: PendingReservationsFilters = {},
  hookOptions: UsePendingReservationsOptions = {},
): UsePendingReservationsResult {
  const { autoFetch = true } = hookOptions;

  const [status, setStatus] = useState<QueryStatus>('idle');
  const [error, setError] = useState<BackendError | null>(null);
  const [data, setData] = useState<ListReservationsResponse['data']>(null);

  const serviceRef = useRef(service);
  serviceRef.current = service;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const refetch = useCallback(async (): Promise<ListReservationsResponse> => {
    setStatus('loading');
    setError(null);
    try {
      const res = await executeListPendingReservations(serviceRef.current, filtersRef.current);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, status, error, refetch };
}
