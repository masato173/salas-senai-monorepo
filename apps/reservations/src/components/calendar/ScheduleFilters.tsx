import React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import type { Turno, RoomType } from '../../types';

// ── Tipos ──────────────────────────────────────────────────────
export interface ScheduleFilterState {
  turno:    Turno | 'TODOS';
  roomType: RoomType | 'TODOS';
  search:   string;
}

interface ScheduleFiltersProps {
  filters:   ScheduleFilterState;
  onChange:  (f: ScheduleFilterState) => void;
  totalResults: number;
}

// ── Dados dos filtros ──────────────────────────────────────────
const TURNO_OPTIONS: { value: ScheduleFilterState['turno']; label: string; icon: string }[] = [
  { value: 'TODOS', label: 'Todos',       icon: '⊙'  },
  { value: 'M',     label: 'Matutino',    icon: '☀'  },
  { value: 'V',     label: 'Vespertino',  icon: '🌤' },
  { value: 'N',     label: 'Noturno',     icon: '🌙' },
];

const ROOM_TYPE_OPTIONS: { value: ScheduleFilterState['roomType']; label: string }[] = [
  { value: 'TODOS',           label: 'Todos os tipos'     },
  { value: 'SALA_COMUM',      label: 'Salas comuns'       },
  { value: 'LAB_INFORMATICA', label: 'Lab. Informática'   },
  { value: 'LAB_CLP',         label: 'Lab. CLP'           },
  { value: 'LAB_ELETRICA',    label: 'Lab. Elétrica'      },
  { value: 'LAB_SMT',         label: 'Lab. SMT'           },
  { value: 'LAB_ELETRONICA',  label: 'Lab. Eletrônica'    },
  { value: 'LAB_GERAL',       label: 'Lab. Geral'         },
];

// ── Componente ─────────────────────────────────────────────────
export function ScheduleFilters({ filters, onChange, totalResults }: ScheduleFiltersProps) {
  const hasActive = filters.turno !== 'TODOS' || filters.roomType !== 'TODOS' || filters.search !== '';

  function set<K extends keyof ScheduleFilterState>(key: K, value: ScheduleFilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  function reset() {
    onChange({ turno: 'TODOS', roomType: 'TODOS', search: '' });
  }

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius)',
      padding: '12px 16px',
      marginBottom: '16px',
      boxShadow: 'var(--shadow-s)',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>

        {/* Busca por sala */}
        <div style={{ flex: '1', minWidth: '180px' }}>
          <FilterLabel>Sala</FilterLabel>
          <input
            type="text"
            value={filters.search}
            onChange={e => set('search', e.target.value)}
            placeholder="Ex: 603, Lab CLP..."
            maxLength={40}
            style={inputStyle}
          />
        </div>

        {/* Tipo de sala */}
        <div style={{ flex: '1', minWidth: '170px' }}>
          <FilterLabel>Tipo</FilterLabel>
          <select
            value={filters.roomType}
            onChange={e => set('roomType', e.target.value as ScheduleFilterState['roomType'])}
            style={inputStyle}
          >
            {ROOM_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Turno — botões pill */}
        <div>
          <FilterLabel>Turno</FilterLabel>
          <div style={{ display: 'flex', gap: '4px' }}>
            {TURNO_OPTIONS.map(o => {
              const active = filters.turno === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => set('turno', o.value)}
                  style={{
                    height: '34px', padding: '0 12px',
                    borderRadius: 'var(--radius-s)',
                    border: active
                      ? '1px solid var(--color-brand)'
                      : '1px solid var(--color-border)',
                    background: active ? 'var(--color-brand)' : 'var(--color-surface)',
                    color:      active ? '#fff' : 'var(--color-muted)',
                    fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'background .15s, border-color .15s, color .15s',
                  }}
                >
                  {o.icon} {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Limpar + contador */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
            <SlidersHorizontal size={11} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            {totalResults} sala{totalResults !== 1 ? 's' : ''}
          </span>
          {hasActive && (
            <button
              onClick={reset}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                height: '32px', padding: '0 10px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-s)',
                background: 'none', color: 'var(--color-muted)',
                fontSize: '11px', fontWeight: 600, fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <X size={11} /> Limpar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: 600, letterSpacing: '.06em',
      textTransform: 'uppercase', color: 'var(--color-muted)',
      marginBottom: '5px',
    }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  height: '34px', padding: '0 10px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontFamily: 'inherit', fontSize: '12px',
  outline: 'none', width: '100%',
};
