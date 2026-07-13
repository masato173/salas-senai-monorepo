import React from 'react';

// ─────────────────────────────────────────────────────────────
// Pagination — F6.4
//
// Paginação completa: << < 1 2 [3] 4 5 ... 48 > >>
// Janela deslizante de 5 páginas ao redor da atual.
// ─────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

function buildPages(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const window = new Set<number>();
  window.add(1);
  window.add(total);
  for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
    window.add(i);
  }

  const sorted = [...window].sort((a, b) => a - b);
  const result: (number | '...')[] = [];

  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i]);
    if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) {
      result.push('...');
    }
  }

  return result;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  disabled = false,
}: PaginationProps): JSX.Element | null {
  if (totalPages <= 1) return null;

  const pages = buildPages(page, totalPages);

  const btnStyle = (active = false, dis = false): React.CSSProperties => ({
    minWidth: 32,
    height: 32,
    padding: '0 8px',
    border: `1px solid ${active ? 'var(--color-brand)' : 'var(--color-border)'}`,
    borderRadius: 6,
    background: active ? 'var(--color-brand)' : 'var(--color-surface)',
    color: active ? '#fff' : dis ? 'var(--color-subtle)' : 'var(--color-text)',
    fontSize: 13,
    cursor: dis ? 'not-allowed' : 'pointer',
    opacity: dis ? 0.5 : 1,
    fontWeight: active ? 600 : 400,
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 16,
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
        Página {page} de {totalPages} · {total} registros
        {limit > 0 && ` · ${limit} por página`}
      </span>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {/* Primeira */}
        <button
          style={btnStyle(false, page === 1 || disabled)}
          disabled={page === 1 || disabled}
          onClick={() => onPageChange(1)}
          aria-label="Primeira página"
        >
          «
        </button>

        {/* Anterior */}
        <button
          style={btnStyle(false, page === 1 || disabled)}
          disabled={page === 1 || disabled}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          ‹
        </button>

        {/* Janela */}
        {pages.map((p, i) =>
          p === '...' ? (
            <span
              key={`dots-${i}`}
              style={{ padding: '0 4px', color: 'var(--color-subtle)', lineHeight: '32px' }}
            >
              …
            </span>
          ) : (
            <button
              key={p}
              style={btnStyle(p === page, disabled)}
              disabled={disabled}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ),
        )}

        {/* Próxima */}
        <button
          style={btnStyle(false, page === totalPages || disabled)}
          disabled={page === totalPages || disabled}
          onClick={() => onPageChange(page + 1)}
          aria-label="Próxima página"
        >
          ›
        </button>

        {/* Última */}
        <button
          style={btnStyle(false, page === totalPages || disabled)}
          disabled={page === totalPages || disabled}
          onClick={() => onPageChange(totalPages)}
          aria-label="Última página"
        >
          »
        </button>
      </div>
    </div>
  );
}
