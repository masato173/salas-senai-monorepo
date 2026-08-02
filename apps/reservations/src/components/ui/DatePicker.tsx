// DatePicker — dropdown customizado (glass), substitui <input type="date">
// nativo em todo o app. Visual: gatilho estilo input + painel flutuante
// com navegação de mês e grade de 6 semanas.
//
// TIMEZONE: toda a matemática de grade usa Date.UTC(...,12) + getUTC* —
// mesma técnica de scheduleDateUtils.ts (UTC noon trick, regra histórica
// do projeto, ver MEMORY.md Bug #8). value/onChange sempre YYYY-MM-DD,
// nunca Date. min/max comparados como string (YYYY-MM-DD ordena lexico
// = cronológico, já estabelecido no projeto).
//
// Reaproveita ymdToUtcDate/todayYmd/formatDataBR/weekdayShort de
// scheduleDateUtils.ts — não duplica.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { todayYmd, formatDataBR } from '../dashboard/scheduleDateUtils';

export interface DatePickerProps {
  id?: string;
  value: string; // YYYY-MM-DD ou ''
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  'aria-label'?: string;
  // 'left' (padrão) ancora a borda esquerda do painel na borda esquerda do
  // gatilho — certo pra campo de formulário. 'right' ancora pela direita —
  // usar quando o gatilho fica perto da borda direita da tela (ex.:
  // ScheduleHeader, mesmo padrão de NotificationBell.tsx), senão o painel
  // (mais largo que o gatilho) vaza pra fora do viewport.
  align?: 'left' | 'right';
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
// dia 0 do mês seguinte = último dia do mês atual (m é 1-indexado)
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
}
function firstWeekdayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m - 1, 1, 12)).getUTCDay();
}

interface CalendarCell {
  ymd: string;
  day: number;
  inCurrentMonth: boolean;
}

// Pura e exportada — testável sem montar o componente. Sempre 42 células
// (6 semanas x 7 dias), padrão de grade de calendário.
export function buildMonthGrid(y: number, m: number): CalendarCell[] {
  const firstWeekday = firstWeekdayOfMonth(y, m);
  const totalDays = daysInMonth(y, m);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const prevMonthDays = daysInMonth(prevYear, prevMonth);

  const cells: CalendarCell[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    cells.push({ ymd: ymd(prevYear, prevMonth, day), day, inCurrentMonth: false });
  }
  for (let day = 1; day <= totalDays; day++) {
    cells.push({ ymd: ymd(y, m, day), day, inCurrentMonth: true });
  }
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ ymd: ymd(nextYear, nextMonth, nextDay), day: nextDay, inCurrentMonth: false });
    nextDay++;
  }
  return cells;
}

function monthLabel(m: number): string {
  const name = MONTH_NAMES[m - 1] ?? '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  placeholder = 'Selecionar data…',
  'aria-label': ariaLabel,
  align = 'left',
}: DatePickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const base = value !== '' ? value : todayYmd();
  const [baseY, baseM] = base.split('-').map(Number);
  const [viewYear, setViewYear] = useState(baseY);
  const [viewMonth, setViewMonth] = useState(baseM);
  const rootRef = useRef<HTMLDivElement>(null);

  // Reabre sempre no mês do valor atual (ou hoje, sem valor).
  useEffect(() => {
    if (open) {
      const [y, m] = base.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando abre
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function goPrevMonth(): void {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  }
  function goNextMonth(): void {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  }

  const cells = buildMonthGrid(viewYear, viewMonth);
  const todayIso = todayYmd();

  return (
    <div ref={rootRef} style={wrapperStyle}>
      <button
        type="button"
        id={id}
        className="ui-picker-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen(o => !o)}
        style={{
          ...triggerStyle,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <Calendar size={14} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
        <span
          style={{
            color: value !== '' ? 'var(--color-text)' : 'var(--color-subtle)',
            flex: 1,
            textAlign: 'left',
          }}
        >
          {value !== '' ? formatDataBR(value) : placeholder}
        </span>
        <ChevronDown
          size={14}
          style={{
            color: 'var(--color-muted)',
            flexShrink: 0,
            transition: `transform ${'var(--dur)'} ${'var(--ease)'}`,
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>
      {/* input hidden — mantém required/validação nativa de formulário sem input type=date visível */}
      {required && <input type="hidden" value={value} required aria-hidden="true" />}

      {open && (
        <div
          role="dialog"
          aria-label="Selecionar data"
          style={{ ...panelStyle, ...(align === 'right' ? { left: 'auto', right: 0 } : {}) }}
        >
          <div style={navRowStyle}>
            <button
              type="button"
              className="ui-picker-nav-btn"
              onClick={goPrevMonth}
              aria-label="Mês anterior"
              style={navBtnStyle}
            >
              <ChevronLeft size={15} />
            </button>
            <span style={navLabelStyle}>
              {monthLabel(viewMonth)} {viewYear}
            </span>
            <button
              type="button"
              className="ui-picker-nav-btn"
              onClick={goNextMonth}
              aria-label="Próximo mês"
              style={navBtnStyle}
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div style={weekdayRowStyle}>
            {WEEKDAYS.map(w => (
              <span key={w} style={weekdayCellStyle}>
                {w}
              </span>
            ))}
          </div>

          <div style={gridStyle}>
            {cells.map(cell => {
              const isSelected = cell.ymd === value;
              const isToday = cell.ymd === todayIso;
              const isDisabled =
                (min !== undefined && cell.ymd < min) || (max !== undefined && cell.ymd > max);
              return (
                <button
                  key={cell.ymd}
                  type="button"
                  className={`ui-picker-day${isSelected ? ' ui-picker-day--selected' : ''}`}
                  disabled={isDisabled}
                  onClick={() => {
                    onChange(cell.ymd);
                    setOpen(false);
                  }}
                  style={{
                    ...dayCellStyle,
                    color: isDisabled
                      ? 'var(--color-subtle)'
                      : !cell.inCurrentMonth
                        ? 'var(--color-subtle)'
                        : 'var(--color-text)',
                    background: isSelected
                      ? 'var(--color-brand)'
                      : isToday
                        ? 'var(--color-accent-l)'
                        : 'transparent',
                    fontWeight: isSelected || isToday ? 700 : 500,
                    ...(isSelected ? { color: '#fff' } : {}),
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.4 : 1,
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles — tokens only, mesma altura (34px) padronizada nos 6 lugares
// que hoje usam <input type="date"> com alturas inconsistentes (34-40px).
// ─────────────────────────────────────────────────────────────

const wrapperStyle: CSSProperties = { position: 'relative', width: '100%' };

const triggerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  height: '34px',
  width: '100%',
  padding: '0 10px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface)',
  fontFamily: 'inherit',
  fontSize: '12px',
  boxSizing: 'border-box',
};

const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  zIndex: 300,
  width: '280px',
  background: 'var(--color-surface)',
  backdropFilter: 'blur(var(--glass-blur-s)) saturate(150%)',
  WebkitBackdropFilter: 'blur(var(--glass-blur-s)) saturate(150%)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-m), var(--glass-sheen)',
  padding: '12px',
  animation: 'pageFadeIn var(--dur) var(--ease) both',
};

const navRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '8px',
};

const navBtnStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: '26px',
  height: '26px',
  borderRadius: 'var(--radius-s)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-2)',
  color: 'var(--color-text)',
  cursor: 'pointer',
};

const navLabelStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--color-text)',
};

const weekdayRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  marginBottom: '4px',
};

const weekdayCellStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: '10px',
  fontWeight: 600,
  color: 'var(--color-muted)',
  padding: '4px 0',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: '2px',
};

const dayCellStyle: CSSProperties = {
  height: '30px',
  border: 'none',
  borderRadius: 'var(--radius-s)',
  background: 'transparent',
  fontFamily: 'inherit',
  fontSize: '12px',
  fontVariantNumeric: 'tabular-nums',
  transition: 'background var(--dur) var(--ease), color var(--dur) var(--ease)',
};
