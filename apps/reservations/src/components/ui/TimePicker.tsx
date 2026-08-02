// TimePicker — dropdown customizado (glass), substitui <input type="time">
// nativo em todo o app. Lista rolável de horários em passos fixos, item
// selecionado com check — mesma linguagem visual do DatePicker irmão.
//
// value/onChange sempre string HH:MM (mesmo contrato do input nativo que
// substitui). min/max/step default 06:00–23:00/30min: não é uma regra de
// negócio nova — é o horário de reserva já documentado no projeto
// (06:00→23:00); o backend continua sendo a validação autoritativa,
// isso é só o range que o dropdown lista.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, Clock, ChevronDown } from 'lucide-react';

export interface TimePickerProps {
  id?: string;
  value: string; // HH:MM ou ''
  onChange: (value: string) => void;
  min?: string; // HH:MM
  max?: string; // HH:MM
  step?: number; // minutos
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  'aria-label'?: string;
  // Ver DatePicker.tsx — mesmo propósito (evita painel vazando pra fora
  // do viewport perto da borda direita da tela).
  align?: 'left' | 'right';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minutesToTime(min: number): string {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

// Pura e exportada — testável sem montar o componente.
export function buildTimeSlots(min: string, max: string, step: number): string[] {
  const start = timeToMinutes(min);
  const end = timeToMinutes(max);
  const slots: string[] = [];
  for (let t = start; t <= end; t += step) slots.push(minutesToTime(t));
  return slots;
}

export function TimePicker({
  id,
  value,
  onChange,
  min = '06:00',
  max = '23:00',
  step = 30,
  required,
  disabled,
  placeholder = 'Selecionar…',
  'aria-label': ariaLabel,
  align = 'left',
}: TimePickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  const slots = buildTimeSlots(min, max, step);

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

  useEffect(() => {
    if (open) selectedRef.current?.scrollIntoView({ block: 'center' });
  }, [open]);

  return (
    <div ref={rootRef} style={wrapperStyle}>
      <button
        type="button"
        id={id}
        className="ui-picker-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen(o => !o)}
        style={{
          ...triggerStyle,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <Clock size={14} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
        <span
          style={{
            color: value !== '' ? 'var(--color-text)' : 'var(--color-subtle)',
            flex: 1,
            textAlign: 'left',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value !== '' ? value : placeholder}
        </span>
        <ChevronDown
          size={14}
          style={{
            color: 'var(--color-muted)',
            flexShrink: 0,
            transition: 'transform var(--dur) var(--ease)',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>
      {required && <input type="hidden" value={value} required aria-hidden="true" />}

      {open && (
        <div
          role="listbox"
          aria-label="Selecionar horário"
          style={{ ...panelStyle, ...(align === 'right' ? { left: 'auto', right: 0 } : {}) }}
        >
          {slots.map(t => {
            const isSelected = t === value;
            return (
              <button
                key={t}
                type="button"
                className={`ui-picker-option${isSelected ? ' ui-picker-option--selected' : ''}`}
                role="option"
                aria-selected={isSelected}
                ref={isSelected ? selectedRef : undefined}
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
                style={{
                  ...optionStyle,
                  background: isSelected ? 'var(--color-brand)' : 'transparent',
                  color: isSelected ? '#fff' : 'var(--color-text)',
                  fontWeight: isSelected ? 700 : 500,
                }}
              >
                <span>{t}</span>
                {isSelected && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles — tokens only, mesma altura (34px) do DatePicker irmão.
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
  width: '100%',
  minWidth: '140px',
  maxHeight: '240px',
  overflowY: 'auto',
  background: 'var(--color-surface)',
  backdropFilter: 'blur(var(--glass-blur-s)) saturate(150%)',
  WebkitBackdropFilter: 'blur(var(--glass-blur-s)) saturate(150%)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-m), var(--glass-sheen)',
  padding: '6px',
  animation: 'pageFadeIn var(--dur) var(--ease) both',
};

const optionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  height: '30px',
  padding: '0 10px',
  border: 'none',
  borderRadius: 'var(--radius-s)',
  fontFamily: 'inherit',
  fontSize: '12px',
  fontVariantNumeric: 'tabular-nums',
  cursor: 'pointer',
  transition: 'background var(--dur) var(--ease), color var(--dur) var(--ease)',
};
