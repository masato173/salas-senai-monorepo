import { useCallback, useRef, useState } from 'react';
import type {
  CreateReservationRequest,
  CreateReservationResponse,
  BackendError,
} from '../services/apiTypes';

// ─────────────────────────────────────────────────────────────
// Política de retry — idempotente via clientRequestId.
// Retenta APENAS:
//   - falha de rede (fetch lança)
//   - envelope ok=false com error.code === 'INTERNAL'
// NUNCA retenta CONFLICT, VALIDATION, DUPLICATE, LOCK_TIMEOUT.
// ─────────────────────────────────────────────────────────────

interface ReservationCreator {
  createReservation: (req: CreateReservationRequest) => Promise<CreateReservationResponse>;
}

interface ExecuteOptions {
  clientRequestId?: string;
  maxRetries?: number; // default 2
}

export async function executeCreateReservation(
  service: ReservationCreator,
  req: Omit<CreateReservationRequest, 'clientRequestId'>,
  options: ExecuteOptions = {},
): Promise<CreateReservationResponse> {
  const clientRequestId = options.clientRequestId ?? crypto.randomUUID();
  const maxRetries = options.maxRetries ?? 2;

  let lastEnvelope: CreateReservationResponse | undefined;
  let lastNetError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await service.createReservation({ ...req, clientRequestId });

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

interface UseCreateReservationResult {
  mutate: (
    req: Omit<CreateReservationRequest, 'clientRequestId'>,
  ) => Promise<CreateReservationResponse>;
  status: MutationStatus;
  error: BackendError | null;
  data: CreateReservationResponse['data'];
  reset: () => void;
}

export function useCreateReservation(service: ReservationCreator): UseCreateReservationResult {
  const [status, setStatus] = useState<MutationStatus>('idle');
  const [error, setError] = useState<BackendError | null>(null);
  const [data, setData] = useState<CreateReservationResponse['data']>(null);

  // Mantém estável entre renders sem recriar callback.
  const serviceRef = useRef(service);
  serviceRef.current = service;

  const mutate = useCallback(async (req: Omit<CreateReservationRequest, 'clientRequestId'>) => {
    setStatus('loading');
    setError(null);

    try {
      const res = await executeCreateReservation(serviceRef.current, req);
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

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setData(null);
  }, []);

  return { mutate, status, error, data, reset };
}
