import { useCallback, useRef, useState } from 'react';
import type {
  CreateReservationRangeRequest,
  CreateReservationRangeResponse,
  BackendError,
} from '../services/apiTypes';

// ─────────────────────────────────────────────────────────────
// Política de retry — idempotente via clientRequestId.
// Retenta APENAS:
//   - falha de rede (fetch lança)
//   - envelope ok=false com error.code === 'INTERNAL'
// NUNCA retenta CONFLICT, VALIDATION, DUPLICATE, LOCK_TIMEOUT.
//
// Espelha useCreateReservation. Tech-debt conhecida: a lógica é idêntica;
// um useMutation<TReq,TRes> genérico eliminaria a duplicação, mas exigiria
// refatorar o hook antigo (intocável agora).
// ─────────────────────────────────────────────────────────────

interface ReservationRangeCreator {
  createReservationRange: (
    req: CreateReservationRangeRequest,
  ) => Promise<CreateReservationRangeResponse>;
}

interface ExecuteOptions {
  clientRequestId?: string;
  maxRetries?: number; // default 2
}

export async function executeCreateReservationRange(
  service: ReservationRangeCreator,
  req: Omit<CreateReservationRangeRequest, 'clientRequestId'>,
  options: ExecuteOptions = {},
): Promise<CreateReservationRangeResponse> {
  const clientRequestId = options.clientRequestId ?? crypto.randomUUID();
  const maxRetries = options.maxRetries ?? 2;

  let lastEnvelope: CreateReservationRangeResponse | undefined;
  let lastNetError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await service.createReservationRange({ ...req, clientRequestId });
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

type RangeMutationStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseCreateReservationRangeResult {
  mutate: (
    req: Omit<CreateReservationRangeRequest, 'clientRequestId'>,
  ) => Promise<CreateReservationRangeResponse>;
  status: RangeMutationStatus;
  error: BackendError | null;
  data: CreateReservationRangeResponse['data'];
  reset: () => void;
}

export function useCreateReservationRange(
  service: ReservationRangeCreator,
): UseCreateReservationRangeResult {
  const [status, setStatus] = useState<RangeMutationStatus>('idle');
  const [error, setError] = useState<BackendError | null>(null);
  const [data, setData] = useState<CreateReservationRangeResponse['data']>(null);

  const serviceRef = useRef(service);
  serviceRef.current = service;

  const mutate = useCallback(
    async (req: Omit<CreateReservationRangeRequest, 'clientRequestId'>) => {
      setStatus('loading');
      setError(null);

      try {
        const res = await executeCreateReservationRange(serviceRef.current, req);
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
