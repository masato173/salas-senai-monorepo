import { useCallback, useRef, useState } from 'react';
import type { BackendEnvelope, BackendError } from '../services/apiTypes';
import type { SyncResult } from '@salas-senai/shared';

// ─────────────────────────────────────────────────────────────
// useTriggerSync — F6.5
//
// Mutation hook: POST /sync/schedules.
// Padrão idêntico a useApproveReservation: execute, status, error.
// O caller é responsável por não chamar execute() enquanto
// status === 'loading' (ConflictException propagada como CONFLICT).
// ─────────────────────────────────────────────────────────────

interface SyncTrigger {
  triggerSync(): Promise<BackendEnvelope<SyncResult>>;
}

type MutationStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseTriggerSyncResult {
  execute: () => Promise<BackendEnvelope<SyncResult>>;
  status: MutationStatus;
  data: SyncResult | null;
  error: BackendError | null;
}

export async function executeTriggerSync(
  service: SyncTrigger,
): Promise<BackendEnvelope<SyncResult>> {
  try {
    return await service.triggerSync();
  } catch (err) {
    return {
      ok: false,
      data: null,
      error: {
        code: 'INTERNAL',
        message: err instanceof Error ? err.message : 'Falha de rede.',
      },
    };
  }
}

export function useTriggerSync(service: SyncTrigger): UseTriggerSyncResult {
  const [status, setStatus] = useState<MutationStatus>('idle');
  const [data, setData] = useState<SyncResult | null>(null);
  const [error, setError] = useState<BackendError | null>(null);

  const serviceRef = useRef(service);
  serviceRef.current = service;

  const execute = useCallback(async (): Promise<BackendEnvelope<SyncResult>> => {
    setStatus('loading');
    setData(null);
    setError(null);
    const res = await executeTriggerSync(serviceRef.current);
    if (res.ok && res.data !== null) {
      setData(res.data);
      setStatus('success');
    } else {
      setError(res.error);
      setStatus('error');
    }
    return res;
  }, []);

  return { execute, status, data, error };
}
