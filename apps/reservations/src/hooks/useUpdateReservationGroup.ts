import { useCallback, useRef, useState } from 'react';
import type {
  UpdateReservationGroupRequest,
  UpdateReservationGroupResponse,
  BackendError,
} from '../services/apiTypes';

// ─────────────────────────────────────────────────────────────
// Sprint 4 C2 — editar TODAS as reservas ACTIVE de um grupo (PUT-like).
//
// Mesma política de retry do C1:
//   - retenta apenas INTERNAL + falha de rede
//   - nunca retenta NOT_FOUND, FORBIDDEN, VALIDATION, LOCK_TIMEOUT, CONFLICT
//
// Atomicidade tudo-ou-nada e idempotência state-based no GRUPO vivem no
// backend (test-sprint4-C2.ps1 T4 + T7). O hook só repassa o envelope.
// ─────────────────────────────────────────────────────────────

interface ReservationGroupUpdater {
  updateReservationGroup: (
    req: UpdateReservationGroupRequest,
  ) => Promise<UpdateReservationGroupResponse>;
}

interface ExecuteOptions {
  clientRequestId?: string;
  maxRetries?: number; // default 2
}

export async function executeUpdateReservationGroup(
  service: ReservationGroupUpdater,
  req: Omit<UpdateReservationGroupRequest, 'clientRequestId'>,
  options: ExecuteOptions = {},
): Promise<UpdateReservationGroupResponse> {
  const clientRequestId = options.clientRequestId ?? crypto.randomUUID();
  const maxRetries = options.maxRetries ?? 2;

  let lastEnvelope: UpdateReservationGroupResponse | undefined;
  let lastNetError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await service.updateReservationGroup({ ...req, clientRequestId });

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
// Hook React — fina camada de estado em volta da função pura.
// ─────────────────────────────────────────────────────────────

export type MutationStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseUpdateReservationGroupResult {
  mutate: (
    req: Omit<UpdateReservationGroupRequest, 'clientRequestId'>,
  ) => Promise<UpdateReservationGroupResponse>;
  status: MutationStatus;
  error: BackendError | null;
  data: UpdateReservationGroupResponse['data'];
  reset: () => void;
}

export function useUpdateReservationGroup(
  service: ReservationGroupUpdater,
): UseUpdateReservationGroupResult {
  const [status, setStatus] = useState<MutationStatus>('idle');
  const [error, setError] = useState<BackendError | null>(null);
  const [data, setData] = useState<UpdateReservationGroupResponse['data']>(null);

  const serviceRef = useRef(service);
  serviceRef.current = service;

  const mutate = useCallback(
    async (req: Omit<UpdateReservationGroupRequest, 'clientRequestId'>) => {
      setStatus('loading');
      setError(null);

      try {
        const res = await executeUpdateReservationGroup(serviceRef.current, req);
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
    },
    [],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setData(null);
  }, []);

  return { mutate, status, error, data, reset };
}
