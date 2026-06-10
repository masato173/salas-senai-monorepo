import { useCallback, useRef, useState } from 'react';
import type {
  CancelReservationRequest,
  CancelReservationResponse,
  BackendError,
} from '../services/appsScript';

// ─────────────────────────────────────────────────────────────
// Política de retry — idempotente via clientRequestId.
// Retenta APENAS:
//   - falha de rede (fetch lança)
//   - envelope ok=false com error.code === 'INTERNAL'
// NUNCA retenta NOT_FOUND, FORBIDDEN, VALIDATION, LOCK_TIMEOUT.
// CONFLICT e DUPLICATE não são retornados por cancelReservation.
// Idempotência é state-based (status='CANCELLED'), não por clientRequestId.
// ─────────────────────────────────────────────────────────────

interface ReservationCanceller {
  cancelReservation: (req: CancelReservationRequest) => Promise<CancelReservationResponse>;
}

interface ExecuteOptions {
  clientRequestId?: string;
  maxRetries?:      number; // default 2
}

export async function executeCancelReservation(
  service: ReservationCanceller,
  req:     Omit<CancelReservationRequest, 'clientRequestId'>,
  options: ExecuteOptions = {},
): Promise<CancelReservationResponse> {
  const clientRequestId = options.clientRequestId ?? crypto.randomUUID();
  const maxRetries      = options.maxRetries ?? 2;

  let lastEnvelope: CancelReservationResponse | undefined;
  let lastNetError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await service.cancelReservation({ ...req, clientRequestId });

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

interface UseCancelReservationResult {
  mutate: (req: Omit<CancelReservationRequest, 'clientRequestId'>) => Promise<CancelReservationResponse>;
  status: MutationStatus;
  error:  BackendError | null;
  data:   CancelReservationResponse['data'];
  reset:  () => void;
}

export function useCancelReservation(service: ReservationCanceller): UseCancelReservationResult {
  const [status, setStatus] = useState<MutationStatus>('idle');
  const [error,  setError]  = useState<BackendError | null>(null);
  const [data,   setData]   = useState<CancelReservationResponse['data']>(null);

  const serviceRef = useRef(service);
  serviceRef.current = service;

  const mutate = useCallback(async (req: Omit<CancelReservationRequest, 'clientRequestId'>) => {
    setStatus('loading');
    setError(null);

    try {
      const res = await executeCancelReservation(serviceRef.current, req);
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
