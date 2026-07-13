import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackendError } from '../services/appsScript';

// ─────────────────────────────────────────────────────────────
// useSystemHealth — F6.6
//
// Query hook com auto-refresh via setTimeout recursivo.
// setTimeout recursivo (não setInterval) garante intervalo
// APÓS a conclusão do fetch — não acumula chamadas.
//
// dbStatus inferido: se /health responde, banco provavelmente ok.
// wsStatus sempre 'unknown' até F7.3.
// nodeVersion sempre null — não disponível no frontend.
// ─────────────────────────────────────────────────────────────

export type HealthStatus = 'ok' | 'down' | 'unknown';

export interface SystemHealthData {
  apiStatus: HealthStatus;
  dbStatus: HealthStatus; // inferido da resposta de /health
  wsStatus: HealthStatus; // TODO F7.3
  version: string | null;
  uptime: number | null; // segundos
  serverTimestamp: string | null; // ISO da resposta do servidor
  lastCheckedAt: Date | null; // Date local do último check
  nodeVersion: null; // N/A — não disponível no frontend
}

interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
  version: string;
}

interface HealthFetcher {
  fetchHealth(): Promise<{ ok: boolean; data: HealthResponse | null; error: BackendError | null }>;
}

type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseSystemHealthOptions {
  autoFetch?: boolean; // default: true
  refreshInterval?: number; // default: 30_000ms — 0 desativa auto-refresh
}

export interface UseSystemHealthResult {
  data: SystemHealthData | null;
  status: QueryStatus;
  error: BackendError | null;
  refetch: () => Promise<void>;
}

// Função pura testável
export async function executeSystemHealth(
  service: HealthFetcher,
): Promise<{ ok: boolean; data: HealthResponse | null; error: BackendError | null }> {
  return service.fetchHealth();
}

export function useSystemHealth(
  service: HealthFetcher,
  options: UseSystemHealthOptions = {},
): UseSystemHealthResult {
  const { autoFetch = true, refreshInterval = 30_000 } = options;

  const [status, setStatus] = useState<QueryStatus>('idle');
  const [error, setError] = useState<BackendError | null>(null);
  const [data, setData] = useState<SystemHealthData | null>(null);

  const serviceRef = useRef(service);
  serviceRef.current = service;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // isMounted — evita setState após desmontagem (R2)
  const isMountedRef = useRef(true);

  const refetch = useCallback(async (): Promise<void> => {
    // Cancela timer pendente antes de novo fetch
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isMountedRef.current) setStatus('loading');
    if (isMountedRef.current) setError(null);

    const res = await executeSystemHealth(serviceRef.current);

    // Ignora resultado se componente foi desmontado durante o fetch
    if (!isMountedRef.current) return;

    if (res.ok && res.data !== null) {
      setData({
        apiStatus: 'ok',
        dbStatus: 'ok', // inferido: API responde → banco provavelmente ok
        wsStatus: 'unknown', // TODO F7.3
        version: res.data.version,
        uptime: res.data.uptime,
        serverTimestamp: res.data.timestamp,
        lastCheckedAt: new Date(),
        nodeVersion: null,
      });
      setStatus('success');
    } else {
      // Mantém dados anteriores com status degradado (não apaga version/uptime)
      setData(prev =>
        prev !== null
          ? { ...prev, apiStatus: 'down', dbStatus: 'unknown', lastCheckedAt: new Date() }
          : {
              apiStatus: 'down',
              dbStatus: 'unknown',
              wsStatus: 'unknown',
              version: null,
              uptime: null,
              serverTimestamp: null,
              lastCheckedAt: new Date(),
              nodeVersion: null,
            },
      );
      setError(res.error);
      setStatus('error');
    }

    // Agenda próximo ciclo APÓS conclusão do fetch
    if (refreshInterval > 0 && isMountedRef.current) {
      timerRef.current = setTimeout(() => {
        void refetch();
      }, refreshInterval);
    }
  }, [refreshInterval]);

  useEffect(() => {
    isMountedRef.current = true;
    if (autoFetch) void refetch();

    return () => {
      // Cleanup: cancela timer e marca componente como desmontado
      isMountedRef.current = false;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // Mount-only — intencionalmente sem deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, status, error, refetch };
}
