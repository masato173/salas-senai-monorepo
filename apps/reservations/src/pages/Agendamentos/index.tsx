import { useState, useMemo } from 'react';
import { ScheduleHeader } from '../../components/calendar/ScheduleHeader';
import { ScheduleFilters } from '../../components/calendar/ScheduleFilters';
import { AvailabilityCards } from '../../components/calendar/AvailabilityCards';
import { ScheduleSidebar } from '../../components/calendar/ScheduleSidebar';
import { DayView } from '../../components/calendar/DayView';
import { useAvailabilityBackend, BACKEND_DRIVER_ENABLED } from '../../hooks/useAvailabilityBackend';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import type { ScheduleFilterState } from '../../components/calendar/ScheduleFilters';
import type { SidebarEntry } from '../../components/calendar/ScheduleSidebar';
import type { DisponibilidadeSala } from '../../types';
import { todayYmd } from '../../components/dashboard/scheduleDateUtils';

// ── Mapeamento de disponibilidade → entradas do sidebar/calendário ──
// Função pura, testável em isolamento sem React.
export function mapToEntries(salas: DisponibilidadeSala[]): SidebarEntry[] {
  const entries: SidebarEntry[] = [];

  for (const sala of salas) {
    if (sala.status === 'livre' || sala.eventos.length === 0) {
      entries.push({
        id: sala.sala,
        sala: sala.sala,
        turma: '',
        turno: null,
        start: '07:00',
        end: '22:00',
        status: 'free',
      });
      continue;
    }

    for (const evento of sala.eventos) {
      const status: SidebarEntry['status'] =
        evento.tipo === 'aula' ? 'busy' : sala.status === 'conflito' ? 'busy' : 'pending';

      entries.push({
        id: `${sala.sala}-${evento.inicio}`,
        sala: sala.sala,
        turma: evento.turma ?? '',
        turno: evento.turno ?? null,
        start: evento.inicio,
        end: evento.fim,
        status,
      });
    }
  }

  return entries.sort((a, b) => a.sala.localeCompare(b.sala));
}

// ── Helpers de filtro ──────────────────────────────────────────
// Busca por TURMA (não mais por sala) — mudança explícita da Fase 4.
function matchesTurma(turma: string, search: string): boolean {
  if (!search) return true;
  return turma.toLowerCase().includes(search.toLowerCase());
}

function matchesTurno(turno: SidebarEntry['turno'], filter: ScheduleFilterState['turno']): boolean {
  if (filter === 'TODOS') return true;
  return turno === filter;
}

// roomType filter — inferido do nome da sala (sem campo type na disponibilidade)
function matchesRoomType(sala: string, filter: ScheduleFilterState['roomType']): boolean {
  if (filter === 'TODOS') return true;
  const lower = sala.toLowerCase();
  if (filter === 'LAB_INFORMATICA') return lower.includes('inf');
  if (filter === 'LAB_CLP') return lower.includes('clp');
  if (filter === 'LAB_ELETRICA') return lower.includes('elét') || lower.includes('elet');
  if (filter === 'SALA_COMUM') return lower.includes('sala');
  return true;
}

// ── Componente principal ───────────────────────────────────────
export default function AgendamentosPage() {
  const today = todayYmd();

  const [date, setDate] = useState(today);
  const [filters, setFilters] = useState<ScheduleFilterState>({
    turno: 'TODOS',
    roomType: 'TODOS',
    search: '',
  });
  const [selected, setSelected] = useState<SidebarEntry | null>(null);

  const disp = useAvailabilityBackend(date, undefined, { enabled: BACKEND_DRIVER_ENABLED });
  const stats = useDashboardStats(date, { enabled: BACKEND_DRIVER_ENABLED });
  const isLoading = disp.loading || stats.loading;

  function handleDateChange(d: string) {
    setDate(d);
  }

  // Todas as entradas mapeadas a partir da disponibilidade real
  const allEntries = useMemo(() => mapToEntries(disp.data?.salas ?? []), [disp.data]);

  // Entradas filtradas para o sidebar e calendário
  const filtered = useMemo(
    () =>
      allEntries.filter(
        e =>
          matchesTurma(e.turma, filters.search) &&
          matchesTurno(e.turno, filters.turno) &&
          matchesRoomType(e.sala, filters.roomType),
      ),
    [allEntries, filters],
  );

  // Dados para os cards de resumo — GET /dashboard via SQL
  const summaryData = useMemo(
    () => ({
      totalSalas: stats.data?.totalSalas ?? 0,
      livres: stats.data?.salasLivres ?? 0,
      ocupadas: stats.data?.salasComAula ?? 0,
      reservasPendentes: stats.data?.reservasPendentes ?? 0,
    }),
    [stats.data],
  );

  return (
    <div>
      {/* ── Cabeçalho ────────────────────────────────────── */}
      <ScheduleHeader date={date} onChange={handleDateChange} isLoading={isLoading} />

      {/* ── Cards de disponibilidade ─────────────────────── */}
      <AvailabilityCards data={summaryData} isLoading={isLoading} />

      {/* ── Filtros ──────────────────────────────────────── */}
      <ScheduleFilters filters={filters} onChange={setFilters} totalResults={filtered.length} />

      {/* ── Layout principal: sidebar + calendário ────────── */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start',
        }}
      >
        {/* Painel lateral */}
        <ScheduleSidebar
          date={date}
          entries={filtered}
          isLoading={isLoading}
          onSelect={setSelected}
        />

        {/* Área principal do calendário */}
        <div
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          {/* Card de detalhe — aparece ao selecionar uma sala */}
          {selected && (
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: '12px 16px',
                boxShadow: 'var(--shadow-s)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                animation: 'pageFadeIn .15s ease both',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{selected.sala}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
                  {selected.start} – {selected.end}
                  {selected.turma && ` · ${selected.turma}`}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-muted)',
                  fontSize: '18px',
                  lineHeight: 1,
                }}
                aria-label="Fechar detalhe"
              >
                ×
              </button>
            </div>
          )}

          {/* Grade do calendário */}
          <DayView date={date} entries={filtered} selected={selected} />
        </div>
      </div>

      {/* ── Responsivo: sidebar some em mobile ─────────────
          O sidebar fica abaixo da grade em telas pequenas  */}
      <style>{`
        @media (max-width: 768px) {
          /* Sidebar vai pra baixo do calendário */
          [data-schedule-layout] { flex-direction: column !important; }
        }
      `}</style>
    </div>
  );
}
