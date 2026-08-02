import { type CSSProperties } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

import type { RegistroLegado, Turno } from '../../types';
import type { ScheduleFilterState } from './applyScheduleFilters';
import { formatDataBR, weekdayShort } from './scheduleDateUtils';
import { DatePicker } from '../ui/DatePicker';

// Sprint A3.2 — Dashboard nativo de ocupação. Substitui o iframe legado.
// Sprint A3.5 — REFATORADO pra apresentação CONTROLADA: o pai
// (Dashboard/index.tsx) carrega o estado (useSchedule + filtros + page +
// filtered + derivados); este componente só renderiza UI a partir das props.
//
// UI permanece IDÊNTICA à da A3.2 — única mudança é a fonte do estado.
//
// Rédea visual (frontend-design dentro do DS):
//   • Tokens existentes apenas. TURNO_STYLE com convenção da planilha mensal:
//     Manhã=verde, Tarde=amarelo, Noite=azul. NÃO MEXER nas cores.
//   • Sem dangerouslySetInnerHTML (JSX escapa).
//   • Helpers de data importados de scheduleDateUtils (timezone-safe).

interface OccupancyDashboardProps {
  filtered: RegistroLegado[];
  filtros: ScheduleFilterState;
  onFiltroChange: <K extends keyof ScheduleFilterState>(
    key: K,
    value: ScheduleFilterState[K],
  ) => void;
  page: number;
  onPageChange: (updater: number | ((p: number) => number)) => void;
  salasUnicas: string[];
  mesesUnicos: string[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  onRefetch: () => void;
  onReset: () => void;
  hoje: string;
}

// Rótulos longos pros botões de turno (valor interno permanece M/V/N/TODOS).
const TURNO_FILTRO_LABEL: Record<'TODOS' | 'M' | 'V' | 'N', string> = {
  TODOS: 'Todos',
  M: 'Matutino',
  V: 'Vespertino',
  N: 'Noturno',
};

const PER_PAGE = 40;

const TURNO_LABEL: Record<Turno, string> = {
  M: 'Matutino',
  V: 'Vespertino',
  N: 'Noturno',
};

// Cores espelham a planilha mensal: Manhã=verde, Tarde=amarelo, Noite=azul.
// (Convenção visual que o usuário já reconhece nas abas mensais.)
const TURNO_STYLE: Record<Turno, { bg: string; color: string }> = {
  M: { bg: 'var(--color-green-l)', color: 'var(--color-green)' },
  V: { bg: 'var(--color-amber-l)', color: 'var(--color-amber)' },
  N: { bg: 'var(--color-blue-l)', color: 'var(--color-blue)' },
};

export function OccupancyDashboard({
  filtered,
  filtros,
  onFiltroChange,
  page,
  onPageChange,
  salasUnicas,
  mesesUnicos,
  status,
  error,
  onRefetch,
  onReset,
  hoje,
}: OccupancyDashboardProps): JSX.Element {
  const isLoading = status === 'loading';
  const isError = status === 'error';

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <section style={containerStyle} aria-label="Ocupação de salas">
      {/* ── Barra de ações rápidas ──────────────────────────── */}
      <div style={actionsBarStyle}>
        <button
          type="button"
          onClick={() => onFiltroChange('data', hoje)}
          style={actionPrimaryButtonStyle}
          aria-label="Filtrar pela data de hoje"
        >
          Hoje
        </button>
        <button
          type="button"
          onClick={onReset}
          style={actionButtonStyle}
          aria-label="Limpar todos os filtros"
        >
          Limpar
        </button>
      </div>

      {/* ── Filtros (4 — turma/data/sala/mês) ─────────────── */}
      <div style={filtersRowStyle}>
        <Field label="Turma" htmlFor="occ-turma">
          <input
            id="occ-turma"
            type="text"
            placeholder="Buscar turma…"
            value={filtros.turma}
            onChange={e => onFiltroChange('turma', e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Data" htmlFor="occ-data">
          <DatePicker
            id="occ-data"
            value={filtros.data}
            onChange={v => onFiltroChange('data', v)}
            placeholder="Todas"
          />
        </Field>

        <Field label="Sala" htmlFor="occ-sala">
          <select
            id="occ-sala"
            value={filtros.sala}
            onChange={e => onFiltroChange('sala', e.target.value)}
            style={inputStyle}
          >
            <option value="">Todas</option>
            {salasUnicas.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Mês" htmlFor="occ-mes">
          <select
            id="occ-mes"
            value={filtros.mes}
            onChange={e => onFiltroChange('mes', e.target.value)}
            style={inputStyle}
          >
            <option value="">Todos</option>
            {mesesUnicos.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* ── Turno (linha própria, full-width pra acomodar nomes longos) ── */}
      <Field label="Turno" htmlFor="occ-turno-group">
        <div
          id="occ-turno-group"
          role="radiogroup"
          aria-label="Filtrar por turno"
          style={turnoGroupStyle}
        >
          {(['TODOS', 'M', 'V', 'N'] as const).map(t => {
            const active = filtros.turno === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onFiltroChange('turno', t)}
                style={turnoButtonStyle(active)}
              >
                {TURNO_FILTRO_LABEL[t]}
              </button>
            );
          })}
        </div>
      </Field>

      {/* ── Barra de status: contagem + refetch ───────────────── */}
      <div style={statusBarStyle}>
        <span style={countBadgeStyle}>
          {filtered.length} resultado{filtered.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={onRefetch}
          disabled={isLoading}
          style={{
            ...refreshButtonStyle,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
          }}
          aria-label="Recarregar dados"
        >
          <RefreshCw size={12} aria-hidden="true" />
          Atualizar
        </button>
      </div>

      {/* ── Faixa de erro ─────────────────────────────────────── */}
      {isError && (
        <div role="alert" style={errorBoxStyle}>
          <AlertCircle size={14} style={errorIconStyle} aria-hidden="true" />
          <span style={errorTextStyle}>{error ?? 'Falha ao carregar dados.'}</span>
          <button type="button" onClick={onRefetch} style={retryButtonStyle}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Estado de loading inicial ─────────────────────────── */}
      {isLoading && filtered.length === 0 && (
        <p style={loadingStyle} aria-live="polite">
          Carregando…
        </p>
      )}

      {/* ── Tabela ────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div style={tableWrapperStyle} role="region" aria-label="Tabela de ocupação">
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Turma</th>
                <th style={thStyle}>Sala</th>
                <th style={thStyle}>Turno</th>
              </tr>
            </thead>
            <tbody>
              {pageSlice.map((r, idx) => {
                const isHoje = r.data === hoje;
                const salaIsLab = r.sala.toLowerCase().includes('lab');
                return (
                  <tr key={`${r.data}-${r.sala}-${r.turma}-${idx}`} style={trStyle}>
                    <td style={tdStyle}>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatDataBR(r.data)}
                      </span>
                      <span style={dayOfWeekStyle}> · {weekdayShort(r.data)}</span>
                      {isHoje && <span style={hojeBadgeStyle}>Hoje</span>}
                    </td>
                    <td style={tdStyle}>{r.turma}</td>
                    <td style={{ ...tdStyle, fontWeight: salaIsLab ? 600 : 500 }}>{r.sala}</td>
                    <td style={tdStyle}>
                      {r.turno ? (
                        <span style={turnoBadgeStyle(r.turno)}>{TURNO_LABEL[r.turno]}</span>
                      ) : (
                        <span style={turnoUnknownStyle}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────── */}
      {!isLoading && !isError && filtered.length === 0 && (
        <div style={emptyStateStyle}>
          <p style={emptyTitleStyle}>Nenhum resultado</p>
          <p style={emptySubtitleStyle}>Tente ajustar os filtros.</p>
        </div>
      )}

      {/* ── Paginação ─────────────────────────────────────────── */}
      {filtered.length > PER_PAGE && (
        <div style={paginationStyle} role="navigation" aria-label="Paginação">
          <button
            type="button"
            onClick={() => onPageChange(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            aria-label="Página anterior"
            style={pageButtonStyle(safePage <= 1)}
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <span style={pageInfoStyle} aria-live="polite">
            {safePage} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            aria-label="Próxima página"
            style={pageButtonStyle(safePage >= totalPages)}
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// <Field> — replicado pra evitar tocar ReservationForm (brief).
// ─────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}

function Field({ label, htmlFor, children }: FieldProps): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
      <label htmlFor={htmlFor} style={labelStyle}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles (CSSProperties) — só tokens existentes do DS.
// (Iguais à versão A3.2, intocados.)
// ─────────────────────────────────────────────────────────────

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-s)',
  padding: '20px',
};

const filtersRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '12px',
};

// Barra de ações rápidas (Hoje / Limpar) — sutil, acima dos filtros.
const actionsBarStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  justifyContent: 'flex-start',
};

// Botão neutro de ação rápida. Mesmo gabarito do refreshButtonStyle.
const actionButtonStyle: CSSProperties = {
  height: '32px',
  padding: '0 14px',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  fontFamily: 'inherit',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 120ms, color 120ms, border-color 120ms',
};

// Variante "Hoje" — leve destaque (texto + borda na cor da brand) marcando
// que é a ação primária do par. Mantém visual sóbrio (sem fundo cheio).
const actionPrimaryButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  color: 'var(--color-brand)',
  border: '1px solid var(--color-brand)',
};

const labelStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-muted)',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
};

const inputStyle: CSSProperties = {
  height: '38px',
  padding: '0 12px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontFamily: 'inherit',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
};

const turnoGroupStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: 4,
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-s)',
  height: '38px',
  alignItems: 'center',
};

function turnoButtonStyle(active: boolean): CSSProperties {
  return {
    flex: 1,
    height: '28px',
    border: 'none',
    background: active ? 'var(--color-brand)' : 'transparent',
    color: active ? '#fff' : 'var(--color-muted)',
    borderRadius: 'var(--radius-s)',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 120ms, color 120ms',
  };
}

const statusBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
};

const countBadgeStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  padding: '3px 10px',
  borderRadius: 20,
  background: 'var(--color-blue-l)',
  color: 'var(--color-blue)',
  fontVariantNumeric: 'tabular-nums',
};

const refreshButtonStyle: CSSProperties = {
  height: '28px',
  padding: '0 10px',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  fontFamily: 'inherit',
  fontSize: '12px',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  transition: 'background 120ms',
};

const errorBoxStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 14px',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-red-l)',
  border: '1px solid var(--color-red)',
};

const errorIconStyle: CSSProperties = {
  color: 'var(--color-red)',
  flexShrink: 0,
};

const errorTextStyle: CSSProperties = {
  flex: 1,
  fontSize: '12px',
  color: 'var(--color-red)',
};

const retryButtonStyle: CSSProperties = {
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
};

const loadingStyle: CSSProperties = {
  margin: 0,
  fontSize: '12px',
  color: 'var(--color-muted)',
  fontStyle: 'italic',
};

const tableWrapperStyle: CSSProperties = {
  overflow: 'auto',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-s)',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '13px',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  background: 'var(--color-bg)',
  color: 'var(--color-muted)',
  fontWeight: 600,
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  borderBottom: '1px solid var(--color-border)',
  position: 'sticky',
  top: 0,
};

const trStyle: CSSProperties = {
  borderBottom: '1px solid var(--color-border)',
};

const tdStyle: CSSProperties = {
  padding: '10px 14px',
  color: 'var(--color-text)',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

const dayOfWeekStyle: CSSProperties = {
  color: 'var(--color-muted)',
  fontWeight: 400,
};

const hojeBadgeStyle: CSSProperties = {
  marginLeft: '8px',
  fontSize: '10px',
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 20,
  background: 'var(--color-brand)',
  color: '#fff',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
};

function turnoBadgeStyle(turno: Turno): CSSProperties {
  const s = TURNO_STYLE[turno];
  return {
    fontSize: '10px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    background: s.bg,
    color: s.color,
  };
}

const turnoUnknownStyle: CSSProperties = {
  color: 'var(--color-muted)',
  fontSize: '12px',
};

const emptyStateStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  padding: '32px 16px',
  background: 'var(--color-bg)',
  border: '1px dashed var(--color-border)',
  borderRadius: 'var(--radius-s)',
  textAlign: 'center',
};

const emptyTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-text)',
};

const emptySubtitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '12px',
  color: 'var(--color-muted)',
};

const paginationStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
};

function pageButtonStyle(disabled: boolean): CSSProperties {
  return {
    width: 32,
    height: 32,
    display: 'grid',
    placeItems: 'center',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-s)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.35 : 1,
    transition: 'background 120ms',
  };
}

const pageInfoStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-muted)',
  fontVariantNumeric: 'tabular-nums',
  minWidth: 60,
  textAlign: 'center',
};
