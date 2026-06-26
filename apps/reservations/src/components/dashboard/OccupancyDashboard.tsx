import { useMemo, useState, type CSSProperties } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

import { useSchedule } from '../../hooks/useSchedule';
import type { ScheduleResult } from '../../services/appsScript';
import type { RegistroLegado, Turno } from '../../types';
import { applyScheduleFilters, type ScheduleFilterState } from './applyScheduleFilters';

// Sprint A3.2 — Dashboard nativo de ocupação. Substitui o iframe legado.
// Consome useSchedule (A3.1) + applyScheduleFilters (puro) e renderiza
// tabela paginada (40/página) com os 5 filtros do legado.
//
// Rédea visual (frontend-design dentro do DS):
//   • Tokens existentes apenas. Reusa TURNO_STYLE do ReservationForm (mesma
//     paleta — amber/green/violet — que o legado já usa pra M/V/N).
//   • Sem dangerouslySetInnerHTML (JSX escapa). Sem novos tokens. Sem
//     animação.
//
// ★ TIMEZONE: toda data parseada via UTC-noon (Date.UTC(y, m-1, d, 12)) + getUTC*.
// ZERO new Date(string) cru. Manaus é UTC-4 — bug histórico do projeto.

// ScheduleProvider redeclarado localmente porque a interface em useSchedule.ts
// não é exportada (mínima, 1 método; brief proíbe tocar aquele arquivo).
interface ScheduleProvider {
  fetchSchedule: () => Promise<ScheduleResult>;
}

interface OccupancyDashboardProps {
  service: ScheduleProvider;
}

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

export function OccupancyDashboard({ service }: OccupancyDashboardProps) {
  const schedule = useSchedule(service);

  const [filtros, setFiltros] = useState<ScheduleFilterState>({
    turma: '',
    data: '',
    sala: '',
    mes: '',
    turno: 'TODOS',
  });
  const [page, setPage] = useState<number>(1);

  // Reset page=1 sempre que algum filtro mudar (centraliza num updater).
  function updateFiltro<K extends keyof ScheduleFilterState>(
    key: K,
    value: ScheduleFilterState[K],
  ): void {
    setFiltros(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }

  const registros = useMemo<RegistroLegado[]>(
    () => schedule.data?.registros ?? [],
    [schedule.data],
  );

  const filtered = useMemo<RegistroLegado[]>(
    () => applyScheduleFilters(registros, filtros),
    [registros, filtros],
  );

  const salasUnicas = useMemo<string[]>(
    () => [...new Set(registros.map(r => r.sala))].sort((a, b) => a.localeCompare(b)),
    [registros],
  );
  const mesesUnicos = useMemo<string[]>(() => [...new Set(registros.map(r => r.mes))], [registros]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const hoje = todayYmd();
  const isLoading = schedule.status === 'loading';
  const isError = schedule.status === 'error';

  return (
    <section style={containerStyle} aria-label="Ocupação de salas">
      {/* ── Filtros (5) ───────────────────────────────────────── */}
      <div style={filtersRowStyle}>
        <Field label="Turma" htmlFor="occ-turma">
          <input
            id="occ-turma"
            type="text"
            placeholder="Buscar turma…"
            value={filtros.turma}
            onChange={e => updateFiltro('turma', e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Data" htmlFor="occ-data">
          <input
            id="occ-data"
            type="date"
            value={filtros.data}
            onChange={e => updateFiltro('data', e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Sala" htmlFor="occ-sala">
          <select
            id="occ-sala"
            value={filtros.sala}
            onChange={e => updateFiltro('sala', e.target.value)}
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
            onChange={e => updateFiltro('mes', e.target.value)}
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
                  onClick={() => updateFiltro('turno', t)}
                  style={turnoButtonStyle(active)}
                >
                  {t === 'TODOS' ? 'Todos' : t}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      {/* ── Barra de status: contagem + refetch ───────────────── */}
      <div style={statusBarStyle}>
        <span style={countBadgeStyle}>
          {filtered.length} resultado{filtered.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={() => {
            void schedule.refetch();
          }}
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
          <span style={errorTextStyle}>{schedule.error ?? 'Falha ao carregar dados.'}</span>
          <button
            type="button"
            onClick={() => {
              void schedule.refetch();
            }}
            style={retryButtonStyle}
          >
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
      {!isLoading && !isError && filtered.length === 0 && registros.length > 0 && (
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
            onClick={() => setPage(p => Math.max(1, p - 1))}
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
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
// Helpers — timezone-safe + formatters
// ─────────────────────────────────────────────────────────────

// Date em UTC-noon a partir de YYYY-MM-DD. ZERO new Date(string).
function ymdToUtcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// "hoje" em YYYY-MM-DD via UTC (Manaus é UTC-4 — usar UTC com offset manual
// daria a data local correta; aqui aceitamos o pequeno desvio em horários-
// limite porque "hoje" é só pra pill informativa, não regra de negócio).
function todayYmd(): string {
  const now = new Date();
  // Usa as partes locais (espelha o legado, que também usa locale do navegador).
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function formatDataBR(iso: string): string {
  const dt = ymdToUtcDate(iso);
  return `${pad2(dt.getUTCDate())}/${pad2(dt.getUTCMonth() + 1)}/${dt.getUTCFullYear()}`;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
function weekdayShort(iso: string): string {
  return WEEKDAYS[ymdToUtcDate(iso).getUTCDay()];
}

// ─────────────────────────────────────────────────────────────
// <Field> — replicado pra evitar tocar ReservationForm (brief).
// ─────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}

function Field({ label, htmlFor, children }: FieldProps) {
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
