import React from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { todayYmd } from '../dashboard/scheduleDateUtils';

interface ScheduleHeaderProps {
  date: string; // YYYY-MM-DD
  onChange: (d: string) => void;
  isLoading: boolean;
  title?: string; // default 'Agendamentos'
}

// Formata "Quinta-feira, 15 de maio de 2026"
function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function ScheduleHeader({ date, onChange, isLoading, title }: ScheduleHeaderProps) {
  const today = todayYmd();
  const isToday = date === today;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px',
      }}
    >
      {/* Título + label da data */}
      <div>
        <h1 className="page-title">{title ?? 'Agendamentos'}</h1>
        <p
          className="page-subtitle"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}
        >
          <CalendarDays size={12} />
          {isLoading ? 'Carregando...' : formatDateLabel(date)}
        </p>
      </div>

      {/* Controles de data */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Botão Hoje */}
        {!isToday && (
          <button
            onClick={() => onChange(today)}
            style={btnStyle('#e8effe', '#0057ff')}
            title="Ir para hoje"
          >
            Hoje
          </button>
        )}
        {isToday && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: '20px',
              background: 'var(--color-green-l)',
              color: 'var(--color-green)',
            }}
          >
            Hoje
          </span>
        )}

        {/* Navegar dias */}
        <div style={{ display: 'flex', gap: '2px' }}>
          <button
            onClick={() => onChange(addDays(date, -1))}
            aria-label="Dia anterior"
            style={iconBtnStyle}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => onChange(addDays(date, 1))}
            aria-label="Próximo dia"
            style={iconBtnStyle}
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Input de data */}
        <input
          type="date"
          value={date}
          onChange={e => e.target.value && onChange(e.target.value)}
          style={{
            height: '34px',
            padding: '0 10px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-s)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontFamily: 'inherit',
            fontSize: '12px',
            cursor: 'pointer',
            outline: 'none',
          }}
        />
      </div>
    </div>
  );
}

const btnStyle = (bg: string, color: string): React.CSSProperties => ({
  height: '34px',
  padding: '0 14px',
  border: `1px solid ${color}20`,
  borderRadius: 'var(--radius-s)',
  background: bg,
  color,
  fontFamily: 'inherit',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
});

const iconBtnStyle: React.CSSProperties = {
  width: '34px',
  height: '34px',
  display: 'grid',
  placeItems: 'center',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface)',
  color: 'var(--color-muted)',
  cursor: 'pointer',
  transition: 'background .15s, color .15s',
};
