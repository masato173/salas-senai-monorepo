// Sprint Disponibilidade S8 — Painel de ocupação da sala selecionada.
// Componente PURO de apresentação: recebe { sala, eventos } prontos.
// Sem fetch, sem estado, sem hook.
// Visual: irmão dos cards do Dashboard (tokens DS, zero hex cru).

import type { CSSProperties } from 'react';
import { BookOpen, CalendarCheck, CheckCircle } from 'lucide-react';
import type { SalaEvento } from '../../types';
import { formatDataBR, weekdayShort } from '../dashboard/scheduleDateUtils';

interface RoomAvailabilityPanelProps {
  sala: string;
  eventos: SalaEvento[];
}

const MAX_ITEMS = 30;

// Config por tipo — tokens DS puros.
const TIPO_STYLE: Record<
  SalaEvento['tipo'],
  { label: string; color: string; bg: string; Icon: typeof BookOpen }
> = {
  aula: {
    label: 'Aula',
    color: 'var(--color-red)',
    bg: 'var(--color-red-l)',
    Icon: BookOpen,
  },
  reserva: {
    label: 'Reserva',
    color: 'var(--color-amber)',
    bg: 'var(--color-amber-l)',
    Icon: CalendarCheck,
  },
};

export function RoomAvailabilityPanel({ sala, eventos }: RoomAvailabilityPanelProps): JSX.Element {
  const shown = eventos.slice(0, MAX_ITEMS);
  const overflow = eventos.length - MAX_ITEMS;

  return (
    <section aria-label={`Disponibilidade da sala ${sala}`} style={panelStyle}>
      <header style={headerStyle}>
        <h3 style={titleStyle}>Disponibilidade — {sala}</h3>
        <p style={subtitleStyle}>Próximas aulas e reservas</p>
      </header>

      {eventos.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={listStyle}>
          {shown.map((ev, i) => (
            <EventoItem key={`${ev.tipo}-${ev.data}-${ev.inicio}-${ev.id ?? i}`} ev={ev} />
          ))}
          {overflow > 0 && (
            <span style={moreChipStyle}>
              +{overflow} {overflow === 1 ? 'evento' : 'eventos'} mais
            </span>
          )}
        </div>
      )}
    </section>
  );
}

// ── Item ─────────────────────────────────────────────────────

function EventoItem({ ev }: { ev: SalaEvento }): JSX.Element {
  const s = TIPO_STYLE[ev.tipo];
  const secundaria = ev.tipo === 'aula' ? ev.turma : ev.professor ? `Prof. ${ev.professor}` : null;

  return (
    <article
      style={{
        ...itemBaseStyle,
        borderLeft: `3px solid ${s.color}`,
      }}
    >
      <div style={itemRow1Style}>
        <span style={{ ...chipStyle, background: s.bg, color: s.color }}>
          <s.Icon size={11} strokeWidth={2.2} />
          {s.label}
        </span>
        <span style={dateStyle}>
          {formatDataBR(ev.data).slice(0, 5)} · {weekdayShort(ev.data)}
        </span>
      </div>
      <div style={timeStyle}>
        {ev.inicio} – {ev.fim}
      </div>
      {secundaria && <div style={secundariaStyle}>{secundaria}</div>}
    </article>
  );
}

// ── Empty state ──────────────────────────────────────────────

function EmptyState(): JSX.Element {
  return (
    <div style={emptyStyle}>
      <CheckCircle size={20} style={{ color: 'var(--color-green)' }} />
      <p style={emptyTextStyle}>Nenhuma ocupação encontrada para esta sala.</p>
    </div>
  );
}

// ── Styles (tokens DS puros) ─────────────────────────────────

const panelStyle: CSSProperties = {
  background: 'var(--color-surface)',
  backdropFilter: 'blur(var(--glass-blur-s)) saturate(140%)',
  WebkitBackdropFilter: 'blur(var(--glass-blur-s)) saturate(140%)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-s), var(--glass-sheen)',
  padding: '20px',
};

const headerStyle: CSSProperties = {
  paddingBottom: '12px',
  marginBottom: '12px',
  borderBottom: '1px solid var(--color-border)',
};

const titleStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-text)',
  margin: 0,
};

const subtitleStyle: CSSProperties = {
  fontSize: '11px',
  color: 'var(--color-muted)',
  marginTop: '2px',
};

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  maxHeight: '480px',
  overflowY: 'auto',
  paddingRight: '4px',
};

// --color-surface-2 (não --color-bg): item aninhado dentro de um painel
// já translúcido — mesmo padrão de .slot-item dentro de .avail-card no
// DESIGN.md. --color-bg é opaco e é a cor de fundo da página inteira;
// usá-lo aqui faria o item parecer um buraco em vez de uma superfície
// elevada dentro do painel.
const itemBaseStyle: CSSProperties = {
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-s)',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const itemRow1Style: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
};

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 8px',
  borderRadius: 20,
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
};

const dateStyle: CSSProperties = {
  fontSize: '11px',
  color: 'var(--color-muted)',
  fontWeight: 500,
};

const timeStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-text)',
  fontVariantNumeric: 'tabular-nums',
};

const secundariaStyle: CSSProperties = {
  fontSize: '11px',
  color: 'var(--color-muted)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const moreChipStyle: CSSProperties = {
  alignSelf: 'center',
  fontSize: '10px',
  padding: '4px 10px',
  borderRadius: 20,
  background: 'var(--color-surface-2)',
  border: '1px dashed var(--color-border)',
  color: 'var(--color-muted)',
  marginTop: '4px',
};

const emptyStyle: CSSProperties = {
  padding: '24px 16px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
  border: '1px dashed var(--color-border)',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-green-l)',
};

const emptyTextStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-muted)',
  margin: 0,
  textAlign: 'center',
};
