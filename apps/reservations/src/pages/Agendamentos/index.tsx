import React, { useState, useMemo } from 'react';
import { ScheduleHeader }      from '../../components/calendar/ScheduleHeader';
import { ScheduleFilters }     from '../../components/calendar/ScheduleFilters';
import { AvailabilityCards }   from '../../components/calendar/AvailabilityCards';
import { ScheduleSidebar }     from '../../components/calendar/ScheduleSidebar';
import { CalendarPlaceholder } from '../../components/calendar/CalendarPlaceholder';
import type { ScheduleFilterState } from '../../components/calendar/ScheduleFilters';
import type { SidebarEntry }        from '../../components/calendar/ScheduleSidebar';

// ── Mock de dados ──────────────────────────────────────────────
// Fase 4: substituir por useQuery() → Apps Script / API
const MOCK_ENTRIES: SidebarEntry[] = [
  { id:'1',  sala:'603 Sala',       turma:'APB.ADM.148', turno:'M', start:'07:30', end:'09:30', status:'busy'    },
  { id:'2',  sala:'605 Sala',       turma:'APB.OPL.015', turno:'V', start:'13:30', end:'15:30', status:'busy'    },
  { id:'3',  sala:'607 Sala',       turma:'',            turno:null, start:'07:30', end:'22:00', status:'free'   },
  { id:'4',  sala:'608 Sala',       turma:'APB.OPL.079', turno:'M', start:'09:45', end:'11:45', status:'busy'    },
  { id:'5',  sala:'610 Lab. Inf.',  turma:'APB.HML.003', turno:'N', start:'18:30', end:'20:30', status:'busy'    },
  { id:'6',  sala:'612 Lab. CLP',   turma:'',            turno:null, start:'07:30', end:'22:00', status:'free'   },
  { id:'7',  sala:'614 Lab. Elét.', turma:'APB.ELT.010', turno:'V', start:'15:45', end:'17:45', status:'pending' },
  { id:'8',  sala:'701 Sala',       turma:'',            turno:null, start:'07:30', end:'22:00', status:'free'   },
];

// ── Helpers de filtro ──────────────────────────────────────────
function matchesSearch(sala: string, search: string): boolean {
  if (!search) return true;
  return sala.toLowerCase().includes(search.toLowerCase());
}

function matchesTurno(turno: SidebarEntry['turno'], filter: ScheduleFilterState['turno']): boolean {
  if (filter === 'TODOS') return true;
  return turno === filter;
}

// roomType filter — inferido do nome da sala para o mock
// Fase 4: usar campo type direto do backend
function matchesRoomType(sala: string, filter: ScheduleFilterState['roomType']): boolean {
  if (filter === 'TODOS') return true;
  const lower = sala.toLowerCase();
  if (filter === 'LAB_INFORMATICA') return lower.includes('inf');
  if (filter === 'LAB_CLP')         return lower.includes('clp');
  if (filter === 'LAB_ELETRICA')    return lower.includes('elét') || lower.includes('elet');
  if (filter === 'SALA_COMUM')      return lower.includes('sala');
  return true;
}

// ── Componente principal ───────────────────────────────────────
export default function AgendamentosPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [date,      setDate]      = useState(today);
  const [isLoading, setIsLoading] = useState(false);
  const [filters,   setFilters]   = useState<ScheduleFilterState>({
    turno:    'TODOS',
    roomType: 'TODOS',
    search:   '',
  });
  const [selected, setSelected] = useState<SidebarEntry | null>(null);

  // Simula loading ao trocar de data
  function handleDateChange(d: string) {
    setDate(d);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 600);
  }

  // Entradas filtradas para o sidebar
  const filtered = useMemo(() =>
    MOCK_ENTRIES.filter(e =>
      matchesSearch(e.sala,  filters.search) &&
      matchesTurno(e.turno,  filters.turno)  &&
      matchesRoomType(e.sala, filters.roomType),
    ),
    [filters],
  );

  // Dados para os cards de resumo
  const summaryData = useMemo(() => ({
    totalSalas:        MOCK_ENTRIES.length,
    livres:            MOCK_ENTRIES.filter(e => e.status === 'free').length,
    ocupadas:          MOCK_ENTRIES.filter(e => e.status === 'busy').length,
    reservasPendentes: MOCK_ENTRIES.filter(e => e.status === 'pending').length,
  }), []);

  return (
    <div>
      {/* ── Cabeçalho ────────────────────────────────────── */}
      <ScheduleHeader
        date={date}
        onChange={handleDateChange}
        isLoading={isLoading}
      />

      {/* ── Cards de disponibilidade ─────────────────────── */}
      <AvailabilityCards
        data={summaryData}
        isLoading={isLoading}
      />

      {/* ── Filtros ──────────────────────────────────────── */}
      <ScheduleFilters
        filters={filters}
        onChange={setFilters}
        totalResults={filtered.length}
      />

      {/* ── Layout principal: sidebar + calendário ────────── */}
      <div style={{
        display: 'flex', gap: '16px', alignItems: 'flex-start',
      }}>
        {/* Painel lateral */}
        <ScheduleSidebar
          date={date}
          entries={filtered}
          isLoading={isLoading}
          onSelect={setSelected}
        />

        {/* Área principal do calendário */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Card de detalhe — aparece ao selecionar uma sala */}
          {selected && (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: '12px 16px',
              boxShadow: 'var(--shadow-s)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
              animation: 'pageFadeIn .15s ease both',
            }}>
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
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-muted)', fontSize: '18px', lineHeight: 1,
                }}
                aria-label="Fechar detalhe"
              >
                ×
              </button>
            </div>
          )}

          {/* Grade do calendário */}
          <CalendarPlaceholder date={date} />
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
