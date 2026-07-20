import { useState, useCallback, useRef } from 'react';
import type { BackendError } from '../services/apiTypes';
import type { AdminUser, UserListParams, PaginatedResponse } from '../types';

// ─────────────────────────────────────────────────────────────
// useListUsers — F6.7
//
// Query hook com AbortController para cancelar request anterior.
// Duck-typed service interface — testável sem o serviço real.
// ─────────────────────────────────────────────────────────────

interface UserListApi {
  listUsers(
    params: UserListParams,
    signal?: AbortSignal,
  ): Promise<{
    ok: boolean;
    data: PaginatedResponse<AdminUser> | null;
    error: BackendError | null;
  }>;
}

type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseListUsersResult {
  data: PaginatedResponse<AdminUser> | null;
  status: QueryStatus;
  error: BackendError | null;
  fetch: (params: UserListParams) => Promise<void>;
}

// Função pura testável
export async function executeListUsers(
  service: UserListApi,
  params: UserListParams,
  signal?: AbortSignal,
): Promise<{ ok: boolean; data: PaginatedResponse<AdminUser> | null; error: BackendError | null }> {
  return service.listUsers(params, signal);
}

export function useListUsers(service: UserListApi): UseListUsersResult {
  const [status, setStatus] = useState<QueryStatus>('idle');
  const [data, setData] = useState<PaginatedResponse<AdminUser> | null>(null);
  const [error, setError] = useState<BackendError | null>(null);

  const serviceRef = useRef(service);
  serviceRef.current = service;
  const abortRef = useRef<AbortController | null>(null);

  const fetch = useCallback(async (params: UserListParams): Promise<void> => {
    if (abortRef.current !== null) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('loading');
    setError(null);

    const res = await executeListUsers(serviceRef.current, params, controller.signal);

    // Cancelamento silencioso — não é erro real
    if (res.error?.message === 'ABORTED') return;

    if (res.ok && res.data !== null) {
      setData(res.data);
      setStatus('success');
    } else {
      setError(res.error);
      setStatus('error');
    }
  }, []);

  return { data, status, error, fetch };
}
