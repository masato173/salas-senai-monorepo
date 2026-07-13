import { useState, useCallback, useRef } from 'react';
import type { BackendError, BackendErrorCode } from '../services/appsScript';
import type { AdminUser } from '../types';

// ─────────────────────────────────────────────────────────────
// useUpdateUser — F6.7
//
// Mutation hook para updateRole e setActive.
// Expõe funções puras execute* para facilitar testes unitários.
// ─────────────────────────────────────────────────────────────

interface UserUpdateApi {
  updateUserRole(
    id: string,
    role: AdminUser['role'],
  ): Promise<{ ok: boolean; data: AdminUser | null; error: BackendError | null }>;
  setUserActive(
    id: string,
    isActive: boolean,
  ): Promise<{ ok: boolean; data: AdminUser | null; error: BackendError | null }>;
}

type MutationStatus = 'idle' | 'loading' | 'success' | 'error';

type UpdateResult = { ok: boolean; data: AdminUser | null; error: BackendError | null };

function wrapError(e: unknown): BackendError {
  return {
    code: 'INTERNAL' as BackendErrorCode,
    message: e instanceof Error ? e.message : 'Erro inesperado.',
  };
}

// Funções puras testáveis
export async function executeUpdateRole(
  service: UserUpdateApi,
  id: string,
  role: AdminUser['role'],
): Promise<UpdateResult> {
  try {
    return await service.updateUserRole(id, role);
  } catch (e) {
    return { ok: false, data: null, error: wrapError(e) };
  }
}

export async function executeSetActive(
  service: UserUpdateApi,
  id: string,
  isActive: boolean,
): Promise<UpdateResult> {
  try {
    return await service.setUserActive(id, isActive);
  } catch (e) {
    return { ok: false, data: null, error: wrapError(e) };
  }
}

export interface UseUpdateUserResult {
  updateRole: (id: string, role: AdminUser['role']) => Promise<AdminUser | null>;
  setActive: (id: string, isActive: boolean) => Promise<AdminUser | null>;
  status: MutationStatus;
  error: BackendError | null;
  reset: () => void;
}

export function useUpdateUser(service: UserUpdateApi): UseUpdateUserResult {
  const [status, setStatus] = useState<MutationStatus>('idle');
  const [error, setError] = useState<BackendError | null>(null);

  const serviceRef = useRef(service);
  serviceRef.current = service;

  const updateRole = useCallback(
    async (id: string, role: AdminUser['role']): Promise<AdminUser | null> => {
      setStatus('loading');
      setError(null);
      const res = await executeUpdateRole(serviceRef.current, id, role);
      if (res.ok && res.data !== null) {
        setStatus('success');
        return res.data;
      }
      setError(res.error);
      setStatus('error');
      return null;
    },
    [],
  );

  const setActive = useCallback(
    async (id: string, isActive: boolean): Promise<AdminUser | null> => {
      setStatus('loading');
      setError(null);
      const res = await executeSetActive(serviceRef.current, id, isActive);
      if (res.ok && res.data !== null) {
        setStatus('success');
        return res.data;
      }
      setError(res.error);
      setStatus('error');
      return null;
    },
    [],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return { updateRole, setActive, status, error, reset };
}
