import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackendError } from '../services/apiTypes';
import type { PaginatedResponse, AuditLog, AuditQuery } from '../types';

// ─────────────────────────────────────────────────────────────
// useSyncHistory — F6.5
//
// Query hook: GET /audit?action=SYNC_SCHEDULES&page=1&limit=10
// Thin wrapper sobre useAuditLogs com filtro fixo SYNC_SCHEDULES.
// Usa AbortController para cancelar request anterior — seguro
// para refetch após cada triggerSync().
// ─────────────────────────────────────────────────────────────

interface SyncHistoryService {
  listAuditLogs(
    q: AuditQuery,
    signal?: AbortSignal,
  ): Promise<{ ok: boolean; data: PaginatedResponse<AuditLog> | null; error: BackendError | null }>;
}

type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseSyncHistoryResult {
  data: PaginatedResponse<AuditLog> | null;
  status: QueryStatus;
  error: BackendError | null;
  refetch: () => Promise<void>;
}

// Filtro fixo — todas as chamadas usam este query
const SYNC_QUERY: AuditQuery = { action: 'SYNC_SCHEDULES', page: 1, limit: 10 };

// Função pura testável
export async function executeSyncHistory(
  service: SyncHistoryService,
  signal?: AbortSignal,
): Promise<{ ok: boolean; data: PaginatedResponse<AuditLog> | null; error: BackendError | null }> {
  return service.listAuditLogs(SYNC_QUERY, signal);
}

export function useSyncHistory(
  service: SyncHistoryService,
  options: { autoFetch?: boolean } = {},
): UseSyncHistoryResult {
  const { autoFetch = true } = options;

  const [status, setStatus] = useState<QueryStatus>('idle');
  const [error, setError] = useState<BackendError | null>(null);
  const [data, setData] = useState<PaginatedResponse<AuditLog> | null>(null);

  const serviceRef = useRef(service);
  serviceRef.current = service;
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    // Cancela request anterior
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setStatus('loading');
    setError(null);

    const res = await executeSyncHistory(serviceRef.current, abortRef.current.signal);

    // AbortError — ignorar silenciosamente (refetch posterior venceu)
    if (!res.ok && res.error?.message === 'ABORTED') return;

    if (res.ok && res.data !== null) {
      setData(res.data);
      setStatus('success');
    } else {
      setError(res.error);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (autoFetch) void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, status, error, refetch };
}
