import { useCallback, useRef, useState } from 'react';
import type {
  UpdateReservationSelectedRequest,
  UpdateReservationSelectedResponse,
  BackendError,
} from '../services/apiTypes';

// ─────────────────────────────────────────────────────────────
// Sprint 4 C3 — remanejar ocorrências SELECIONADAS de um grupo.
//
// ⚠️ FLAG 1 — RETRY DESABILITADO (maxRetries: 0). NÃO MUDAR PRA 2.
// O backend C3 faz split com novo UUID. Se retentar em INTERNAL,
// gera DUPLO SPLIT = reservas duplicadas. Exceção consciente à
// política padrão dos outros hooks de update (que usam 2).
// Confirmado no header de codigo.gs.sprint4-C3 e nos testes
// test-sprint4-C3.ps1 (13/13). Atomicidade lógica (não-transacional)
// vive no backend; o hook só repassa o envelope SEM retentar.
// ─────────────────────────────────────────────────────────────

interface ReservationSelectedUpdater {
  updateReservationSelected: (
    req: UpdateReservationSelectedRequest,
  ) => Promise<UpdateReservationSelectedResponse>;
}

interface ExecuteOptions {
  clientRequestId?: string;
  maxRetries?: number; // ⚠️ default 0 — ver FLAG 1 acima
}

export async function executeUpdateReservationSelected(
  service: ReservationSelectedUpdater,
  req: Omit<UpdateReservationSelectedRequest, 'clientRequestId'>,
  options: ExecuteOptions = {},
): Promise<UpdateReservationSelectedResponse> {
  const clientRequestId = options.clientRequestId ?? crypto.randomUUID();
  // ⚠️ FLAG 1 do C3: ZERO retries por default. NÃO usar 2 (vide comentário no topo).
  const maxRetries = options.maxRetries ?? 0;

  let lastEnvelope: UpdateReservationSelectedResponse | undefined;
  let lastNetError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await service.updateReservationSelected({ ...req, clientRequestId });

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

interface UseUpdateReservationSelectedResult {
  mutate: (
    req: Omit<UpdateReservationSelectedRequest, 'clientRequestId'>,
  ) => Promise<UpdateReservationSelectedResponse>;
  status: MutationStatus;
  error: BackendError | null;
  data: UpdateReservationSelectedResponse['data'];
  reset: () => void;
}

export function useUpdateReservationSelected(
  service: ReservationSelectedUpdater,
): UseUpdateReservationSelectedResult {
  const [status, setStatus] = useState<MutationStatus>('idle');
  const [error, setError] = useState<BackendError | null>(null);
  const [data, setData] = useState<UpdateReservationSelectedResponse['data']>(null);

  const serviceRef = useRef(service);
  serviceRef.current = service;

  const mutate = useCallback(
    async (
      req: Omit<UpdateReservationSelectedRequest, 'clientRequestId'>,
    ): Promise<UpdateReservationSelectedResponse> => {
      setStatus('loading');
      setError(null);

      try {
        // ⚠️ FLAG 1 do C3: maxRetries:0 EXPLÍCITO aqui (dupla defesa).
        // Mesmo se alguém mudar o default da execute*, este caller mantém zero retries.
        const res = await executeUpdateReservationSelected(serviceRef.current, req, {
          maxRetries: 0,
        });
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

  const reset = useCallback((): void => {
    setStatus('idle');
    setError(null);
    setData(null);
  }, []);

  return { mutate, status, error, data, reset };
}
