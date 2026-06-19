import { useCallback, useRef, useState } from 'react';
import type {
  UpdateReservationRequest,
  UpdateReservationResponse,
  BackendError,
} from '../services/appsScript';

// ─────────────────────────────────────────────────────────────
// Sprint 4 C1 — editar UMA reserva (PUT-like).
//
// Política de retry — idempotente via clientRequestId.
// Retenta APENAS:
//   - falha de rede (fetch lança)
//   - envelope ok=false com error.code === 'INTERNAL'
// NUNCA retenta NOT_FOUND, FORBIDDEN, VALIDATION, LOCK_TIMEOUT, CONFLICT.
// DUPLICATE não é retornado por updateReservation.
// Idempotência é state-based no backend (payload === row atual → no-op),
// não por clientRequestId. Ver test-sprint4-C1.ps1 T7.
// ─────────────────────────────────────────────────────────────

interface ReservationUpdater {
  updateReservation: (req: UpdateReservationRequest) => Promise<UpdateReservationResponse>;
}

interface ExecuteOptions {
  clientRequestId?: string;
  maxRetries?:      number; // default 2
}

export async function executeUpdateReservation(
  service: ReservationUpdater,
  req:     Omit<UpdateReservationRequest, 'clientRequestId'>,
  options: ExecuteOptions = {},
): Promise<UpdateReservationResponse> {
  const clientRequestId = options.clientRequestId ?? crypto.randomUUID();
  const maxRetries      = options.maxRetries ?? 2;

  let lastEnvelope: UpdateReservationResponse | undefined;
  let lastNetError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await service.updateReservation({ ...req, clientRequestId });

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

interface UseUpdateReservationResult {
  mutate: (req: Omit<UpdateReservationRequest, 'clientRequestId'>) => Promise<UpdateReservationResponse>;
  status: MutationStatus;
  error:  BackendError | null;
  data:   UpdateReservationResponse['data'];
  reset:  () => void;
}

export function useUpdateReservation(service: ReservationUpdater): UseUpdateReservationResult {
  const [status, setStatus] = useState<MutationStatus>('idle');
  const [error,  setError]  = useState<BackendError | null>(null);
  const [data,   setData]   = useState<UpdateReservationResponse['data']>(null);

  const serviceRef = useRef(service);
  serviceRef.current = service;

  const mutate = useCallback(async (req: Omit<UpdateReservationRequest, 'clientRequestId'>) => {
    setStatus('loading');
    setError(null);

    try {
      const res = await executeUpdateReservation(serviceRef.current, req);
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
        code:    'INTERNAL',
        message: err instanceof Error ? err.message : 'Falha de rede.',
      };
      setError(networkError);
      setStatus('error');
      return { ok: false, data: null, error: networkError };
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setData(null);
  }, []);

  return { mutate, status, error, data, reset };
}
