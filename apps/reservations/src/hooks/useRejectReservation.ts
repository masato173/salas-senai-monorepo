import { useCallback, useRef, useState } from 'react';
import type { BackendEnvelope, CreatedReservationRow, BackendError } from '../services/apiTypes';

type UpdateStatusResponse = BackendEnvelope<CreatedReservationRow>;

interface ReservationStatusUpdater {
  updateStatus(id: string, status: 'APPROVED' | 'REJECTED'): Promise<UpdateStatusResponse>;
}

type MutationStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseRejectReservationResult {
  execute: (id: string) => Promise<UpdateStatusResponse>;
  status: MutationStatus;
  error: BackendError | null;
}

export async function executeRejectReservation(
  service: ReservationStatusUpdater,
  id: string,
): Promise<UpdateStatusResponse> {
  try {
    return await service.updateStatus(id, 'REJECTED');
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

export function useRejectReservation(
  service: ReservationStatusUpdater,
): UseRejectReservationResult {
  const [status, setStatus] = useState<MutationStatus>('idle');
  const [error, setError] = useState<BackendError | null>(null);

  const serviceRef = useRef(service);
  serviceRef.current = service;

  const execute = useCallback(async (id: string): Promise<UpdateStatusResponse> => {
    setStatus('loading');
    setError(null);
    const res = await executeRejectReservation(serviceRef.current, id);
    if (res.ok) setStatus('success');
    else {
      setError(res.error);
      setStatus('error');
    }
    return res;
  }, []);

  return { execute, status, error };
}
