import { useMemo, useState, type CSSProperties } from 'react';
import { AlertCircle } from 'lucide-react';

import { useRealtimeSocket } from '../../hooks/useRealtimeSocket';
import { useAvailabilityBackend } from '../../hooks/useAvailabilityBackend';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { DashboardStats } from '../../components/dashboard/DashboardStats';
import { OccupancyUnified } from '../../components/dashboard/OccupancyUnified';
import { ScheduleHeader } from '../../components/calendar/ScheduleHeader';
import { todayYmd } from '../../components/dashboard/scheduleDateUtils';
import type { DisponibilidadeSala } from '../../types';

// Sprint A3 — Dashboard nativo (cards + tabela de ocupação). Sem iframe.
//
// Unificação Schedule+Reservation: a planilha Google Sheets institucional
// vira estática após jul/2026 — o foco operacional migra pra Reservation
// (PostgreSQL nativo). Fonte única agora é GET /availability
// (DisponibilidadeSala.eventos já mistura tipo:'aula' e tipo:'reserva').
// A tabela histórica de Schedule (useSchedule + applyScheduleFilters +
// OccupancyDashboard) migrou pra /admin/sync — "Reservas recentes" foi
// fundida nesta tabela unificada do dia.
//
// F-fix — a unificação original travou a página em "hoje" sem filtro
// nenhum (regressão vs. a antiga tabela de Schedule, que tinha navegação
// de data + busca). ScheduleHeader (já usado em /agendamentos) devolve a
// navegação; busca por turma/sala é um painel simples, sem reaproveitar
// toda a complexidade de ScheduleFilters — roomType não se aplica aqui
// (a visão já é do dia inteiro). Turno foi adicionado depois numa barra
// separada (mesmos pill buttons de ScheduleFilters), não dentro desse
// painel de busca — pedido explícito de manter "mais separado".

interface DashboardSearch {
  turma: string;
  sala: string;
  turno: 'TODOS' | 'M' | 'V' | 'N';
}

const TURNO_FILTER_OPTIONS: { value: DashboardSearch['turno']; label: string; icon: string }[] = [
  { value: 'TODOS', label: 'Todos', icon: '⊙' },
  { value: 'M', label: 'Matutino', icon: '☀' },
  { value: 'V', label: 'Vespertino', icon: '🌤' },
  { value: 'N', label: 'Noturno', icon: '🌙' },
];

const searchInputStyle: CSSProperties = {
  height: '34px',
  padding: '0 10px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontFamily: 'inherit',
  fontSize: '12px',
  outline: 'none',
  width: '100%',
};

const searchLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--color-muted)',
  marginBottom: '5px',
};

// Pura — filtra salas por turma (evento) e/ou nome de sala, case-insensitive.
// Salas livres (eventos.length === 0) só passam na busca de turma quando
// ela está vazia (não têm turma pra comparar).
export function filterSalas(
  salas: DisponibilidadeSala[],
  search: DashboardSearch,
): DisponibilidadeSala[] {
  const salaQuery = search.sala.trim().toLowerCase();
  const turmaQuery = search.turma.trim().toLowerCase();

  return salas.filter(sala => {
    if (salaQuery && !sala.sala.toLowerCase().includes(salaQuery)) return false;
    if (turmaQuery && !sala.eventos.some(ev => ev.turma?.toLowerCase().includes(turmaQuery))) {
      return false;
    }
    if (search.turno !== 'TODOS' && !sala.eventos.some(ev => ev.turno === search.turno)) {
      return false;
    }
    return true;
  });
}

export function DashboardPage(): JSX.Element {
  const [date, setDate] = useState(todayYmd());
  const [search, setSearch] = useState<DashboardSearch>({ turma: '', sala: '', turno: 'TODOS' });

  // Fonte de dados única do dia — sem fallback local (useAvailability,
  // que dependia de Schedule, saiu de cena com a unificação). enabled:true
  // incondicional: BACKEND_DRIVER_ENABLED deve estar true em produção e não
  // há mais path alternativo pra cair caso esteja false, então sempre busca.
  const disp = useAvailabilityBackend(date, undefined, { enabled: true });
  const stats = useDashboardStats(date, { enabled: true });

  // F7.3b — realtime: reserva muda em qualquer sala → disponibilidade do
  // dia e stats do backend são recarregadas.
  useRealtimeSocket({
    onReservationEvent: (_event, _payload) => {
      disp.refetch();
      stats.refetch();
    },
  });

  const filteredSalas = useMemo(
    () => filterSalas(disp.data?.salas ?? [], search),
    [disp.data, search],
  );

  return (
    <div>
      <ScheduleHeader date={date} onChange={setDate} isLoading={disp.loading} title="Dashboard" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <DashboardStats
          hoje={date}
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
          <>
            {/* Busca — painel simples (turma + sala), sem os filtros de
                turno/roomType de ScheduleFilters (não se aplicam aqui). */}
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: '12px 16px',
                boxShadow: 'var(--shadow-s)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label htmlFor="dash-busca-turma" style={searchLabelStyle}>
                  Turma
                </label>
                <input
                  id="dash-busca-turma"
                  type="text"
                  value={search.turma}
                  onChange={e => setSearch(prev => ({ ...prev, turma: e.target.value }))}
                  placeholder="Ex: APB.ADM, TEC.REC..."
                  maxLength={40}
                  style={searchInputStyle}
                />
              </div>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label htmlFor="dash-busca-sala" style={searchLabelStyle}>
                  Sala
                </label>
                <input
                  id="dash-busca-sala"
                  type="text"
                  value={search.sala}
                  onChange={e => setSearch(prev => ({ ...prev, sala: e.target.value }))}
                  placeholder="Ex: 603, Lab CLP..."
                  maxLength={40}
                  style={searchInputStyle}
                />
              </div>
            </div>

            {/* Turno — barra separada, largura total, mesmo padrão visual
                de ScheduleFilters (pill buttons ⊙☀🌤🌙). */}
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: '10px 16px',
                boxShadow: 'var(--shadow-s)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ ...searchLabelStyle, marginBottom: 0, marginRight: '4px' }}>
                Turno
              </span>
              {TURNO_FILTER_OPTIONS.map(o => {
                const active = search.turno === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setSearch(prev => ({ ...prev, turno: o.value }))}
                    style={{
                      height: '32px',
                      padding: '0 14px',
                      borderRadius: 'var(--radius-s)',
                      border: active
                        ? '1px solid var(--color-brand)'
                        : '1px solid var(--color-border)',
                      background: active ? 'var(--color-brand)' : 'var(--color-surface)',
                      color: active ? '#fff' : 'var(--color-muted)',
                      fontSize: '12px',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'background .15s, border-color .15s, color .15s',
                    }}
                  >
                    {o.icon} {o.label}
                  </button>
                );
              })}
            </div>

            <OccupancyUnified salas={filteredSalas} isLoading={disp.loading} />
          </>
        )}
      </div>
    </div>
  );
}
