import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaginatedResponse, AuditLog, AuditQuery } from '../types';
import type { BackendError } from '../services/apiTypes';

// ─────────────────────────────────────────────────────────────
// useAuditLogs — F6.4
//
// Query hook com:
//   - AbortController: cancela request anterior a cada refetch
//   - Cache em memória: Map<queryString, PaginatedResponse<AuditLog>>
//   - Padrão exato do projeto (useRef, useCallback, mount-only effect)
//
// AbortError é tratado silenciosamente — não atualiza estado de erro.
// ─────────────────────────────────────────────────────────────

// Cache por sessão — fora do hook (módulo ES)
const auditCache = new Map<string, PaginatedResponse<AuditLog>>();

function cacheKey(q: AuditQuery): string {
  const params = new URLSearchParams();
  if (q.action) params.set('action', q.action);
  if (q.entityType) params.set('entityType', q.entityType);
  if (q.from) params.set('from', q.from);
  if (q.to) params.set('to', q.to);
  params.set('page', String(q.page));
  params.set('limit', String(q.limit));
  return params.toString();
}

interface AuditService {
  listAuditLogs(
    q: AuditQuery,
    signal?: AbortSignal,
  ): Promise<{ ok: boolean; data: PaginatedResponse<AuditLog> | null; error: BackendError | null }>;
}

type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseAuditLogsResult {
  data: PaginatedResponse<AuditLog> | null;
  status: QueryStatus;
  error: BackendError | null;
  refetch: (q?: AuditQuery) => Promise<void>;
  currentQuery: AuditQuery;
}

const DEFAULT_QUERY: AuditQuery = { page: 1, limit: 20 };

// Função pura testável
export async function executeListAuditLogs(
  service: AuditService,
  q: AuditQuery,
  signal?: AbortSignal,
): Promise<{ ok: boolean; data: PaginatedResponse<AuditLog> | null; error: BackendError | null }> {
  return service.listAuditLogs(q, signal);
}

export function useAuditLogs(
  service: AuditService,
  initialQuery: AuditQuery = DEFAULT_QUERY,
  options: { autoFetch?: boolean } = {},
): UseAuditLogsResult {
  const { autoFetch = true } = options;

  const [status, setStatus] = useState<QueryStatus>('idle');
  const [error, setError] = useState<BackendError | null>(null);
  const [data, setData] = useState<PaginatedResponse<AuditLog> | null>(null);
  const [currentQuery, setCurrentQuery] = useState<AuditQuery>(initialQuery);

  const serviceRef = useRef(service);
  serviceRef.current = service;
  const queryRef = useRef(currentQuery);
  queryRef.current = currentQuery;
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async (q?: AuditQuery): Promise<void> => {
    const query = q ?? queryRef.current;

    // Cache hit — serve imediatamente sem loading
    const key = cacheKey(query);
    const cached = auditCache.get(key);
    if (cached !== undefined) {
      setData(cached);
      setCurrentQuery(query);
      setStatus('success');
      return;
    }

    // Cancelar request anterior
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setStatus('loading');
    setError(null);
    if (q !== undefined) setCurrentQuery(q);

    const res = await executeListAuditLogs(serviceRef.current, query, abortRef.current.signal);

    // AbortError — ignorar silenciosamente
    if (!res.ok && res.error?.message === 'ABORTED') return;

    if (res.ok && res.data !== null) {
      auditCache.set(key, res.data);
      setData(res.data);
      setStatus('success');
    } else {
      setError(res.error);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (autoFetch) void refetch();
    // Mount-only — intencionalmente sem deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, status, error, refetch, currentQuery };
}
