import { useMemo, useState } from 'react';

import { createNestjsApiService } from '../../services/nestjsApiService';
import { SALAS } from '../../config';
import { useSchedule } from '../../hooks/useSchedule';
import { useListReservations } from '../../hooks/useListReservations';
import { useRealtimeSocket } from '../../hooks/useRealtimeSocket';
import { useAvailability } from '../../hooks/useAvailability';
import { useAvailabilityBackend, BACKEND_DRIVER_ENABLED } from '../../hooks/useAvailabilityBackend';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import {
  applyScheduleFilters,
  type ScheduleFilterState,
} from '../../components/dashboard/applyScheduleFilters';
import { DashboardStats } from '../../components/dashboard/DashboardStats';
import { OccupancyDashboard } from '../../components/dashboard/OccupancyDashboard';
import { todayYmd, formatDataBR } from '../../components/dashboard/scheduleDateUtils';
import type { RegistroLegado } from '../../types';
import type { CreatedReservationRow } from '../../services/apiTypes';

// Sprint A3 — Dashboard nativo (cards + tabela de ocupação). Sem iframe.

// Estado inicial dos filtros — usado pelo useState inicial e pelo reset.
const ESTADO_INICIAL_FILTROS: ScheduleFilterState = {
  turma: '',
  data: '',
  sala: '',
  mes: '',
  turno: 'TODOS',
};

export function DashboardPage(): JSX.Element {
  // F9.7 — NestJS é fonte única de verdade; fallback Apps Script removido.
  const service = useMemo(() => createNestjsApiService(), []);
  const schedule = useSchedule(service);
  const list = useListReservations(service);

  // F7.3b — realtime: atualiza dashboard quando reservas mudam.
  useRealtimeSocket({
    onReservationEvent: (_event, _payload) => {
      void list.refetch();
    },
  });

  const reservas = useMemo<CreatedReservationRow[]>(
    () => list.data?.reservations ?? [],
    [list.data],
  );

  const [filtros, setFiltros] = useState<ScheduleFilterState>(ESTADO_INICIAL_FILTROS);
  const [page, setPage] = useState<number>(1);

  function updateFiltro<K extends keyof ScheduleFilterState>(
    key: K,
    value: ScheduleFilterState[K],
  ): void {
    setFiltros(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function resetFiltros(): void {
    setFiltros(ESTADO_INICIAL_FILTROS);
    setPage(1);
  }

  const registros = useMemo<RegistroLegado[]>(
    () => schedule.data?.registros ?? [],
    [schedule.data],
  );
  const filtered = useMemo<RegistroLegado[]>(
    () => applyScheduleFilters(registros, filtros),
    [registros, filtros],
  );
  const salasUnicas = useMemo<string[]>(
    () => [...new Set(registros.map(r => r.sala))].sort((a, b) => a.localeCompare(b)),
    [registros],
  );
  const mesesUnicos = useMemo<string[]>(() => [...new Set(registros.map(r => r.mes))], [registros]);

  const hoje = todayYmd();
  // dataStats: usa a data do filtro quando ativa, senão hoje.
  // Corrige bug onde cards de disponibilidade ficavam travados em hoje.
  const dataStats = filtros.data || hoje;
  // S5 — disponibilidade da data ativa: aulas + reservas (não CANCELLED).
  const localDisp = useAvailability(registros, reservas, dataStats, SALAS);
  // F4.7b: quando VITE_BACKEND_DRIVER=true, usa GET /availability do NestJS.
  // Fallback para legado enquanto carrega ou se flag desligada.
  const backendDispDash = useAvailabilityBackend(dataStats, undefined, {
    enabled: BACKEND_DRIVER_ENABLED,
  });
  // F8.5 — stats do dashboard via SQL (GET /dashboard?date=)
  const dashboardStats = useDashboardStats(dataStats, {
    enabled: BACKEND_DRIVER_ENABLED,
  });

  const disponibilidade =
    BACKEND_DRIVER_ENABLED && backendDispDash.data !== null ? backendDispDash.data : localDisp;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral do controle de salas</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <DashboardStats
          filtered={filtered}
          hoje={dataStats}
          disponibilidade={disponibilidade}
          dashboardStats={BACKEND_DRIVER_ENABLED ? dashboardStats.data : null}
        />
        <OccupancyDashboard
          filtered={filtered}
          filtros={filtros}
          onFiltroChange={updateFiltro}
          page={page}
          onPageChange={setPage}
          salasUnicas={salasUnicas}
          mesesUnicos={mesesUnicos}
          status={schedule.status}
          error={schedule.error}
          onRefetch={() => {
            void schedule.refetch();
          }}
          onReset={resetFiltros}
          hoje={hoje}
        />

        {/* Reservas recentes — atualiza em tempo real via F7.3b */}
        {(() => {
          const reservasAprovadas = reservas
            .filter(r => r.status === 'APPROVED' && r.data >= hoje)
            .sort((a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio))
            .slice(0, 10);
          return reservasAprovadas.length > 0 ? (
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-s)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Reservas recentes</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 20,
                    background: 'var(--color-blue-l)',
                    color: 'var(--color-blue)',
                  }}
                >
                  {reservasAprovadas.length}{' '}
                  {reservasAprovadas.length === 1 ? 'reserva' : 'reservas'}
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr
                      style={{
                        background: 'var(--color-surface-2)',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      {['Data', 'Sala', 'Professor', 'Turma', 'Horário', 'Status'].map(h => (
                        <th
                          key={h}
                          style={{
                            padding: '8px 12px',
                            textAlign: 'left',
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--color-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reservasAprovadas.map(r => {
                      const statusColors: Record<string, { bg: string; color: string }> = {
                        PENDING: { bg: 'var(--color-amber-l)', color: 'var(--color-amber)' },
                        APPROVED: { bg: 'var(--color-green-l)', color: 'var(--color-green)' },
                        REJECTED: { bg: 'var(--color-red-l)', color: 'var(--color-red)' },
                        CANCELLED: { bg: 'var(--color-surface-2)', color: 'var(--color-subtle)' },
                      };
                      const statusLabel: Record<string, string> = {
                        PENDING: 'Pendente',
                        APPROVED: 'Aprovada',
                        REJECTED: 'Rejeitada',
                        CANCELLED: 'Cancelada',
                      };
                      const sc = statusColors[r.status] ?? statusColors['PENDING'];
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '8px 12px', color: 'var(--color-text)' }}>
                            {formatDataBR(r.data)}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--color-text)' }}>
                            {r.sala}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--color-muted)' }}>
                            {r.professor || '—'}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--color-muted)' }}>
                            {r.turma || '—'}
                          </td>
                          <td
                            style={{
                              padding: '8px 12px',
                              color: 'var(--color-text)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {r.inicio}–{r.fim}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 10,
                                fontSize: 11,
                                fontWeight: 600,
                                background: sc.bg,
                                color: sc.color,
                              }}
                            >
                              {statusLabel[r.status] ?? r.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null;
        })()}
      </div>
    </div>
  );
}
