import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AlertCircle, Table, Clock } from 'lucide-react';

import { useRealtimeSocket } from '../../hooks/useRealtimeSocket';
import { useAvailabilityBackend } from '../../hooks/useAvailabilityBackend';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { useProfessorNames } from '../../hooks/useProfessorNames';
import { useAuthStore, selectAccessToken } from '../../store/authStore';
import { createNestjsApiService } from '../../services/nestjsApiService';
import { DashboardStats } from '../../components/dashboard/DashboardStats';
import { OccupancyUnified } from '../../components/dashboard/OccupancyUnified';
import { ScheduleHeader } from '../../components/calendar/ScheduleHeader';
import { DayView } from '../../components/calendar/DayView';
import { mapToEntries } from '../../components/dashboard/mapToEntries';
import { todayYmd } from '../../components/dashboard/scheduleDateUtils';
import { withProfessorNames } from '../../components/dashboard/professorNames';
import { createOccupancyRefresher } from '../../components/dashboard/occupancyRefresh';
import type { DisponibilidadeSala } from '../../types';

type DashboardViewMode = 'table' | 'timeline';

const VIEW_MODE_OPTIONS: { value: DashboardViewMode; label: string; Icon: typeof Table }[] = [
  { value: 'table', label: 'Tabela', Icon: Table },
  { value: 'timeline', label: 'Linha do tempo', Icon: Clock },
];

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
  // Alterna a apresentação dos dados já carregados (tabela/linha do tempo) —
  // não dispara refetch, os dois modos consomem o mesmo filteredSalas.
  const [viewMode, setViewMode] = useState<DashboardViewMode>('table');

  // Fonte de dados única do dia — sem fallback local (useAvailability,
  // que dependia de Schedule, saiu de cena com a unificação). enabled:true
  // incondicional: BACKEND_DRIVER_ENABLED deve estar true em produção e não
  // há mais path alternativo pra cair caso esteja false, então sempre busca.
  const disp = useAvailabilityBackend(date, undefined, { enabled: true });
  const stats = useDashboardStats(date, { enabled: true });

  // Issue 5 (fase 2) — nome do professor só pra usuário logado: vem de
  // GET /reservations/day (JWT) e é unido aos eventos de reserva por id.
  // Anônimo: nenhuma chamada, nenhum nome; /availability não muda.
  const service = useMemo(() => createNestjsApiService(), []);
  const accessToken = useAuthStore(selectAccessToken);
  const names = useProfessorNames(service, date, accessToken);

  // F7.3b — realtime: reserva muda em qualquer sala → disponibilidade do
  // dia, nomes e stats do backend são recarregados. Escuta o sinal de
  // ocupação (sem dado de pessoa) e não os eventos reservation.*, que desde
  // a Issue 5 (A4) só vão pro dono + coordenadores. Issue 5 (fase 2): o
  // handler ignora eventos de outra data e junta rajadas numa única rodada
  // (debounce de fim de rajada) — nunca um refetch por evento.
  const latestRef = useRef({ date, disp, stats, names });
  latestRef.current = { date, disp, stats, names };
  const [refresher] = useState(() =>
    createOccupancyRefresher(
      () => latestRef.current.date,
      () => {
        const { disp: d, stats: s, names: n } = latestRef.current;
        d.refetch();
        s.refetch();
        n.refetch();
      },
    ),
  );
  // Troca de data (e unmount): descarta a rodada pendente da data anterior —
  // os hooks de dados já recarregam sozinhos pra data nova.
  useEffect(() => () => refresher.cancel(), [date, refresher]);

  useRealtimeSocket({
    onOccupancyChange: payload => refresher.handle(payload),
  });

  const salasComNomes = useMemo(
    () => withProfessorNames(disp.data?.salas ?? [], names.map),
    [disp.data, names.map],
  );

  const filteredSalas = useMemo(() => filterSalas(salasComNomes, search), [salasComNomes, search]);

  // Entradas pro modo "linha do tempo" (DayView) — mesma fonte já filtrada,
  // sem busca adicional (mesmo padrão de Agendamentos/index.tsx).
  const entries = useMemo(() => mapToEntries(filteredSalas), [filteredSalas]);

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
                turno/roomType de ScheduleFilters (não se aplicam aqui).
                Receita de vidro de 3 partes — mesmo tratamento dos cards
                de estatística acima, consistência entre os blocos da página. */}
            <div
              style={{
                background: 'var(--color-surface)',
                backdropFilter: 'blur(var(--glass-blur-s)) saturate(140%)',
                WebkitBackdropFilter: 'blur(var(--glass-blur-s)) saturate(140%)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: '12px 16px',
                boxShadow: 'var(--shadow-s), var(--glass-sheen)',
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
                de ScheduleFilters (pill buttons ⊙☀🌤🌙). Mesmo vidro do
                painel de busca acima — consistência entre os blocos. */}
            <div
              style={{
                background: 'var(--color-surface)',
                backdropFilter: 'blur(var(--glass-blur-s)) saturate(140%)',
                WebkitBackdropFilter: 'blur(var(--glass-blur-s)) saturate(140%)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: '10px 16px',
                boxShadow: 'var(--shadow-s), var(--glass-sheen)',
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

              {/* Tabela / Linha do tempo — mesmo padrão pill do turno acima,
                  à direita. Só troca apresentação, não refaz a busca. */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}
              >
                <span style={{ ...searchLabelStyle, marginBottom: 0, marginRight: '4px' }}>
                  Visualização
                </span>
                {VIEW_MODE_OPTIONS.map(o => {
                  const active = viewMode === o.value;
                  const Icon = o.Icon;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setViewMode(o.value)}
                      aria-pressed={active}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
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
                      <Icon size={13} strokeWidth={1.75} />
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {viewMode === 'table' ? (
              <OccupancyUnified
                salas={filteredSalas}
                isLoading={disp.loading}
                namesLoading={names.loading}
              />
            ) : (
              <DayView date={date} entries={entries} selected={null} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
