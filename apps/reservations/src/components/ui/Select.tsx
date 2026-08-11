// Select — dropdown customizado (glass), generaliza o padrão do TimePicker
// (lista de opções, mesmo irmão estrutural) pra substituir <select> nativo
// em qualquer lista de {value,label}. Mesma linguagem visual/interação de
// DatePicker/TimePicker — reaproveita as classes .ui-picker-trigger/
// .ui-picker-option já existentes em global.css, zero CSS novo.
//
// Sem ícone fixo no trigger (diferente do Calendar/Clock dos irmãos) —
// domínio genérico demais pra um ícone único fazer sentido; nenhum dos
// <select> substituídos usava ícone.
//
// placeholder só é exibido quando `value` não bate com nenhum option.value
// — na prática, os usos atuais sempre têm um option real pro estado
// "vazio" (ex.: {value:'', label:'Todas as ações'}), então é mais paridade
// de API com DatePicker/TimePicker do que um caminho exercitado hoje.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  'aria-label'?: string;
  // Ver DatePicker/TimePicker — mesmo propósito (evita painel vazando pra
  // fora do viewport perto da borda direita da tela).
  align?: 'left' | 'right';
}

export function Select({
  id,
  value,
  onChange,
  options,
  disabled,
  required,
  placeholder = 'Selecionar…',
  'aria-label': ariaLabel,
  align = 'left',
}: SelectProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  const selected = options.find(o => o.value === value);

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
        <span
          style={{
            color: selected !== undefined ? 'var(--color-text)' : 'var(--color-subtle)',
            flex: 1,
            textAlign: 'left',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {selected?.label ?? placeholder}
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
          aria-label={ariaLabel ?? 'Selecionar opção'}
          style={{ ...panelStyle, ...(align === 'right' ? { left: 'auto', right: 0 } : {}) }}
        >
          {options.map(o => {
            const isSelected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                className={`ui-picker-option${isSelected ? ' ui-picker-option--selected' : ''}`}
                role="option"
                aria-selected={isSelected}
                ref={isSelected ? selectedRef : undefined}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={{
                  ...optionStyle,
                  background: isSelected ? 'var(--color-brand)' : 'transparent',
                  color: isSelected ? '#fff' : 'var(--color-text)',
                  fontWeight: isSelected ? 700 : 500,
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {o.label}
                </span>
                {isSelected && <Check size={14} style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles — tokens only, mesma altura (34px) de DatePicker/TimePicker.
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
  minWidth: '160px',
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
  gap: '8px',
  width: '100%',
  height: '30px',
  padding: '0 10px',
  border: 'none',
  borderRadius: 'var(--radius-s)',
  fontFamily: 'inherit',
  fontSize: '12px',
  cursor: 'pointer',
  transition: 'background var(--dur) var(--ease), color var(--dur) var(--ease)',
};
