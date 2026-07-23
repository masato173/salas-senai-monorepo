import { AlertCircle } from 'lucide-react';

import { useRealtimeSocket } from '../../hooks/useRealtimeSocket';
import { useAvailabilityBackend } from '../../hooks/useAvailabilityBackend';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { DashboardStats } from '../../components/dashboard/DashboardStats';
import { OccupancyUnified } from '../../components/dashboard/OccupancyUnified';
import { todayYmd } from '../../components/dashboard/scheduleDateUtils';

// Sprint A3 — Dashboard nativo (cards + tabela de ocupação). Sem iframe.
//
// Unificação Schedule+Reservation: a planilha Google Sheets institucional
// vira estática após jul/2026 — o foco operacional migra pra Reservation
// (PostgreSQL nativo). Fonte única agora é GET /availability
// (DisponibilidadeSala.eventos já mistura tipo:'aula' e tipo:'reserva').
// A tabela histórica de Schedule (useSchedule + applyScheduleFilters +
// OccupancyDashboard) migrou pra /admin/sync — "Reservas recentes" foi
// fundida nesta tabela unificada do dia.

export function DashboardPage(): JSX.Element {
  const hoje = todayYmd();

  // Fonte de dados única do dia — sem fallback local (useAvailability,
  // que dependia de Schedule, saiu de cena com a unificação). enabled:true
  // incondicional: BACKEND_DRIVER_ENABLED deve estar true em produção e não
  // há mais path alternativo pra cair caso esteja false, então sempre busca.
  const disp = useAvailabilityBackend(hoje, undefined, { enabled: true });
  const stats = useDashboardStats(hoje, { enabled: true });

  // F7.3b — realtime: reserva muda em qualquer sala → disponibilidade do
  // dia e stats do backend são recarregadas.
  useRealtimeSocket({
    onReservationEvent: (_event, _payload) => {
      disp.refetch();
      stats.refetch();
    },
  });

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
          hoje={hoje}
          {...(disp.data !== null ? { disponibilidade: disp.data } : {})}
          dashboardStats={stats.data}
        />

        {disp.error ? (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-s)',
              background: 'var(--color-red-l)',
              border: '1px solid var(--color-red)',
            }}
          >
            <AlertCircle size={14} style={{ color: 'var(--color-red)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '12px', color: 'var(--color-red)' }}>
              {disp.error}
            </span>
            <button
              type="button"
              onClick={() => disp.refetch()}
              style={{
                height: '28px',
                padding: '0 10px',
                borderRadius: 'var(--radius-s)',
                background: 'var(--color-surface)',
                color: 'var(--color-red)',
                border: '1px solid var(--color-red)',
                fontFamily: 'inherit',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <OccupancyUnified salas={disp.data?.salas ?? []} isLoading={disp.loading} />
        )}
      </div>
    </div>
  );
}
