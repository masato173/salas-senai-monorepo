import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Sprint 4 D4.2 — mini-calendário pra selecionar subconjunto das datas
// de um grupo (caso C3). Componente puro, isolado, sem backend.
//
// REGRA SUPREMA — TIMEZONE-SAFE:
//   Nunca usar new Date("YYYY-MM-DD") — parseia UTC meia-noite e em Manaus
//   (UTC-4) vira o dia anterior. Sempre Date.UTC(y, m-1, d, 12) (UTC noon)
//   + getUTC*. Strings de saída via padStart manual.
//
// Assinatura visual: única peça com personalidade é o destaque do dia
// selecionado (border --color-brand + fundo color-mix 12%). Tudo o mais
// segue o DS existente do ReservationDetailsModal/ReservationForm.

interface MiniCalendarProps {
  groupDates: string[]; // YYYY-MM-DD, datas selecionáveis
  selectedDates: string[]; // subconjunto marcado pra remanejar
  onToggle: (date: string) => void; // clique num dia DO grupo
}

const MESES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ── Helpers timezone-safe (obrigatórios pelo brief) ──

function partsToYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function ymdToParts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

// Dia da semana do 1º dia do mês (0=Dom..6=Sáb), via UTC-noon (bug-safe).
function weekdayOfFirst(y: number, m: number): number {
  return new Date(Date.UTC(y, m - 1, 1, 12)).getUTCDay();
}

// Quantos dias no mês (trick: dia 0 do mês seguinte == último dia do atual).
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
}

// ── Tipo discriminado pras células da grade (vazia ou dia real) ──

type Cell = { kind: 'empty'; key: string } | { kind: 'day'; iso: string; day: number };

export function MiniCalendar({ groupDates, selectedDates, onToggle }: MiniCalendarProps) {
  // Ordena uma vez (groupDates já costuma vir ordenado, mas defensivo).
  const sortedDates = useMemo(() => [...groupDates].sort(), [groupDates]);

  // Conjunto único de meses {y,m} presentes em groupDates, ordenado cronologicamente.
  // Setas só navegam entre estes meses.
  const monthsAvail = useMemo(() => {
    const seen = new Map<string, { y: number; m: number }>();
    for (const iso of sortedDates) {
      const { y, m } = ymdToParts(iso);
      const key = `${y}-${m}`;
      if (!seen.has(key)) seen.set(key, { y, m });
    }
    return [...seen.values()].sort((a, b) => (a.y !== b.y ? a.y - b.y : a.m - b.m));
  }, [sortedDates]);

  // Mês inicial: primeiro mês com data; fallback razoável se groupDates vazio.
  const [visibleMonth, setVisibleMonth] = useState<{ y: number; m: number }>(() => {
    if (monthsAvail.length > 0) return monthsAvail[0];
    const today = new Date();
    return { y: today.getUTCFullYear(), m: today.getUTCMonth() + 1 };
  });

  // Índice na lista de meses pra prev/next.
  const currentIdx = monthsAvail.findIndex(
    mm => mm.y === visibleMonth.y && mm.m === visibleMonth.m,
  );
  const canPrev = currentIdx > 0;
  const canNext = currentIdx >= 0 && currentIdx < monthsAvail.length - 1;
  const hasAnyDates = monthsAvail.length > 0;

  function goPrev(): void {
    if (canPrev) setVisibleMonth(monthsAvail[currentIdx - 1]);
  }
  function goNext(): void {
    if (canNext) setVisibleMonth(monthsAvail[currentIdx + 1]);
  }

  // Sets pra lookup O(1) durante o render da grade.
  const groupSet = useMemo(() => new Set(sortedDates), [sortedDates]);
  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates]);

  // Monta a grade do mês visível.
  const { y, m } = visibleMonth;
  const offset = weekdayOfFirst(y, m);
  const total = daysInMonth(y, m);
  const cells: Cell[] = [];
  for (let i = 0; i < offset; i++) cells.push({ kind: 'empty', key: `empty-${i}` });
  for (let d = 1; d <= total; d++) cells.push({ kind: 'day', iso: partsToYmd(y, m, d), day: d });

  const tituloMes = hasAnyDates ? `${MESES_PT[m - 1]} ${y}` : '—';

  return (
    <div role="group" aria-label="Selecionar datas do grupo" style={containerStyle}>
      <div style={headerStyle}>
        <button
          type="button"
          onClick={goPrev}
          disabled={!canPrev}
          aria-label="Mês anterior"
          style={navButtonStyle(!canPrev)}
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>

        <span style={titleStyle} aria-live="polite">
          {tituloMes}
        </span>

        <button
          type="button"
          onClick={goNext}
          disabled={!canNext}
          aria-label="Próximo mês"
          style={navButtonStyle(!canNext)}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>

      <div style={weekHeaderStyle} aria-hidden="true">
        {DIAS_PT.map(d => (
          <div key={d} style={weekDayStyle}>
            {d}
          </div>
        ))}
      </div>

      <div role="grid" style={gridStyle}>
        {cells.map(cell => {
          if (cell.kind === 'empty') {
            return <div key={cell.key} style={emptyCellStyle} aria-hidden="true" />;
          }
          const inGroup = groupSet.has(cell.iso);
          const isSelected = selectedSet.has(cell.iso);

          if (!inGroup) {
            // Estado (1) — fora do grupo: visível mas muted, sem interação.
            return (
              <div key={cell.iso} role="gridcell" aria-disabled="true" style={cellOutsideStyle}>
                {cell.day}
              </div>
            );
          }

          // Estados (2) e (3) — pertence ao grupo (interativo).
          const ariaSuffix = isSelected ? 'selecionado, desmarcar' : 'do grupo, marcar';
          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              onClick={() => onToggle(cell.iso)}
              aria-pressed={isSelected}
              aria-label={`Dia ${cell.day} de ${MESES_PT[m - 1]}, ${ariaSuffix}`}
              style={isSelected ? cellSelectedStyle : cellAvailableStyle}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles (inline CSSProperties, padrão ReservationDetailsModal)
// Apenas tokens permitidos pelo brief: brand/surface/border/text/muted/bg
// + radius-s/shadow-s. Transições ≤ 120ms.
// ─────────────────────────────────────────────────────────────

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '14px',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-s)',
  boxShadow: 'var(--shadow-s)',
  width: '100%',
  maxWidth: '320px',
};

const headerStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28px 1fr 28px',
  alignItems: 'center',
  gap: '8px',
  paddingBottom: '2px',
};

const titleStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--color-text)',
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '.01em',
  userSelect: 'none',
};

function navButtonStyle(disabled: boolean): CSSProperties {
  return {
    width: 28,
    height: 28,
    display: 'grid',
    placeItems: 'center',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-s)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.35 : 1,
    fontFamily: 'inherit',
    transition: 'background 120ms, border-color 120ms, opacity 120ms',
  };
}

const weekHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: '2px',
};

const weekDayStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: '10px',
  fontWeight: 600,
  color: 'var(--color-muted)',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  padding: '4px 0',
  userSelect: 'none',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: '2px',
};

// Base comum das células — quadrada, número centralizado, tabular nums
// pra alinhar 9/10/11 com 1/2/3 sem dancing baseline.
const cellBase: CSSProperties = {
  aspectRatio: '1 / 1',
  minHeight: 32,
  display: 'grid',
  placeItems: 'center',
  fontSize: '12px',
  fontVariantNumeric: 'tabular-nums',
  borderRadius: 'var(--radius-s)',
  fontFamily: 'inherit',
  padding: 0,
  userSelect: 'none',
};

const emptyCellStyle: CSSProperties = {
  ...cellBase,
  background: 'transparent',
};

// Estado (1) — fora do grupo
const cellOutsideStyle: CSSProperties = {
  ...cellBase,
  color: 'var(--color-muted)',
  opacity: 0.35,
  background: 'var(--color-surface)',
  cursor: 'default',
};

// Estado (2) — do grupo, não selecionado
const cellAvailableStyle: CSSProperties = {
  ...cellBase,
  color: 'var(--color-text)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  cursor: 'pointer',
  fontWeight: 500,
  transition: 'background 120ms, border-color 120ms, color 120ms',
};

// Estado (3) — selecionado: a ÚNICA peça com assinatura visual.
// --color-brand-l NÃO existe (verificado em global.css) → color-mix manual.
const cellSelectedStyle: CSSProperties = {
  ...cellBase,
  color: 'var(--color-brand)',
  background: 'color-mix(in srgb, var(--color-brand) 12%, var(--color-surface))',
  border: '1px solid var(--color-brand)',
  cursor: 'pointer',
  fontWeight: 700,
  transition: 'background 120ms, border-color 120ms, color 120ms',
};
