import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// DataTable — F6.4
//
// Tabela genérica com:
//   - Scroll horizontal para telas menores
//   - Estado vazio e skeleton de loading
//   - Linha expandida via expandedContent
//   - Apenas uma linha expandida por vez
// Reutilizável em F6.7 (Usuários) e F6.5 (Sync logs).
// ─────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  width?: string;
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  loading?: boolean;
  expandedContent?: (row: T) => React.ReactNode;
}

const SKELETON_ROWS = 5;

function SkeletonRow({ cols }: { cols: number }): JSX.Element {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '10px 12px' }}>
          <div
            style={{
              height: 14,
              borderRadius: 4,
              background: 'var(--color-surface-2)',
              animation: 'dtPulse 1.4s ease-in-out infinite',
              width: i === 0 ? '60%' : '80%',
            }}
          />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'Nenhum registro encontrado.',
  loading = false,
  expandedContent,
}: DataTableProps<T>): JSX.Element {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const hasExpand = expandedContent !== undefined;
  const colCount = columns.length + (hasExpand ? 1 : 0);

  return (
    <>
      <style>{`
        @keyframes dtPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--color-border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr
              style={{
                background: 'var(--color-surface-2)',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: 'var(--color-muted)',
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    ...(col.width ? { width: col.width } : {}),
                  }}
                >
                  {col.header}
                </th>
              ))}
              {hasExpand && <th style={{ width: 36 }} />}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <SkeletonRow key={i} cols={colCount} />
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  style={{
                    padding: '40px 16px',
                    textAlign: 'center',
                    color: 'var(--color-subtle)',
                    fontSize: 13,
                  }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map(row => {
                const id = rowKey(row);
                const isExpanded = expandedId === id;

                return (
                  <React.Fragment key={id}>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        background: isExpanded ? 'var(--color-surface-2)' : 'var(--color-surface)',
                        transition: 'background 0.1s',
                      }}
                    >
                      {columns.map(col => (
                        <td
                          key={col.key}
                          style={{
                            padding: '10px 12px',
                            color: 'var(--color-text)',
                            verticalAlign: 'middle',
                          }}
                        >
                          {col.render(row)}
                        </td>
                      ))}

                      {hasExpand && (
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <button
                            onClick={() => toggleExpand(id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--color-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              padding: 4,
                              borderRadius: 4,
                            }}
                            aria-label={isExpanded ? 'Recolher' : 'Expandir'}
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
                      )}
                    </tr>

                    {isExpanded && expandedContent && (
                      <tr style={{ background: 'var(--color-bg)' }}>
                        <td colSpan={colCount} style={{ padding: '12px 16px' }}>
                          {expandedContent(row)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
