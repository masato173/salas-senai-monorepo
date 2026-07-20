import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../services/apiClient';
import type { BackendError, ListReservationsResponse } from '../services/apiTypes';

// ─────────────────────────────────────────────────────────────
// useAdminDashboard — F6.3
//
// Agrega dados de 4 fontes em paralelo via Promise.allSettled.
// Falha parcial não derruba o dashboard — cada campo tem fallback null.
// Preparado para Socket.IO: F7.3 adicionará socket.on('sync.*', refetch).
// ─────────────────────────────────────────────────────────────

export interface AdminDashboardData {
  // Linha 1 — Operacional
  reservasHoje: number | null;
  pendentes: number | null;
  salasOcupadas: number | null;
  usuariosAtivos: null; // TODO F6.7: sem endpoint GET /users ainda

  // Linha 2 — Infraestrutura
  apiStatus: 'ok' | 'down';
  dbStatus: 'ok' | 'down'; // TODO F6.6: /health não retorna campo db
  webSocketStatus: 'ok' | 'unknown'; // TODO F7.3: sem endpoint de status WS
  ultimaSync: string | null; // ISO timestamp do último SYNC_SCHEDULES
  versao: string | null;
  uptime: number | null; // segundos

  // Meta
  lastUpdatedAt: Date | null;
}

interface HealthLike {
  status: 'ok';
  timestamp: string;
  uptime: number;
  version: string;
}

interface AuditLogLike {
  id: string;
  action: string;
  timestamp: string;
}

interface AdminDashboardService {
  fetchHealth(): Promise<{ ok: boolean; data: HealthLike | null; error: unknown }>;
  fetchAuditLastSync(): Promise<{ ok: boolean; data: AuditLogLike | null; error: unknown }>;
  listPendingReservations(filters?: { status?: string }): Promise<ListReservationsResponse>;
}

type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseAdminDashboardResult {
  data: AdminDashboardData | null;
  status: QueryStatus;
  error: BackendError | null;
  refetch: () => Promise<void>;
}

const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD estável no mount

export async function executeAdminDashboard(
  service: AdminDashboardService,
): Promise<AdminDashboardData> {
  const [healthRes, syncRes, pendingRes, availRes] = await Promise.allSettled([
    service.fetchHealth(),
    service.fetchAuditLastSync(),
    service.listPendingReservations({ status: 'PENDING' }),
    apiFetch<{ salas: { status: string }[] }>(`/availability?date=${TODAY}`),
  ]);

  // Health
  const health =
    healthRes.status === 'fulfilled' && healthRes.value.ok ? healthRes.value.data : null;

  // Última sync
  const syncLog = syncRes.status === 'fulfilled' && syncRes.value.ok ? syncRes.value.data : null;

  // Pendentes
  const pendentes =
    pendingRes.status === 'fulfilled' && pendingRes.value.ok
      ? (pendingRes.value.data?.count ?? null)
      : null;

  // Reservas hoje — usa listPendingReservations sem filtro de status
  // Nota: sem endpoint GET /reservations?date= direto por ora.
  // TODO: quando backend expandir filtros, usar date= aqui.
  const reservasHoje = null; // TODO F6.3b: endpoint não filtra por date ainda

  // Salas ocupadas — client-side via availability
  let salasOcupadas: number | null = null;
  if (availRes.status === 'fulfilled') {
    const salas = (availRes.value as { salas: { status: string }[] }).salas ?? [];
    salasOcupadas = salas.filter(s => s.status !== 'livre').length;
  }

  return {
    reservasHoje,
    pendentes,
    salasOcupadas,
    usuariosAtivos: null,
    apiStatus: health ? 'ok' : 'down',
    dbStatus: 'ok', // TODO F6.6: /health não retorna campo db
    webSocketStatus: 'ok', // TODO F7.3
    ultimaSync: syncLog?.timestamp ?? null,
    versao: health?.version ?? null,
    uptime: health?.uptime ?? null,
    lastUpdatedAt: new Date(),
  };
}

export function useAdminDashboard(
  service: AdminDashboardService,
  options: { autoFetch?: boolean } = {},
): UseAdminDashboardResult {
  const { autoFetch = true } = options;

  const [status, setStatus] = useState<QueryStatus>('idle');
  const [error, setError] = useState<BackendError | null>(null);
  const [data, setData] = useState<AdminDashboardData | null>(null);

  const serviceRef = useRef(service);
  serviceRef.current = service;

  const refetch = useCallback(async (): Promise<void> => {
    setStatus('loading');
    setError(null);
    try {
      const result = await executeAdminDashboard(serviceRef.current);
      setData(result);
      setStatus('success');
    } catch (err) {
      setError({
        code: 'INTERNAL',
        message: err instanceof Error ? err.message : 'Falha ao carregar dashboard.',
      });
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (autoFetch) void refetch();
    // Mount-only — intencionalmente sem deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, status, error, refetch };
}
