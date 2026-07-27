import { type CSSProperties } from 'react';
import type { DisponibilidadeSala, RoomStatus, SalaEvento } from '../../types';

// Unificação Schedule+Reservation — visão do dia via GET /availability
// (DisponibilidadeSala.eventos já mistura tipo:'aula' e tipo:'reserva').
// Substitui a antiga tabela histórica de Schedule na Dashboard (ver
// OccupancyDashboard, que migrou para /admin/sync).

interface OccupancyUnifiedProps {
  salas: DisponibilidadeSala[];
  isLoading: boolean;
}

// Paleta de STATUS da sala — mesma convenção de STATUS_BADGE em
// ReservationForm.tsx (a única no DS que distingue os 4 RoomStatus com
// cores diferentes: livre=verde, aula=âmbar, reserva=azul, conflito=
// vermelho). Redefinida aqui (não exportada de lá) pra não acoplar a um
// componente de formulário só por causa de uma constante de 4 linhas.
export const STATUS_STYLE: Record<RoomStatus, { label: string; color: string; bg: string }> = {
  livre: { label: 'Livre', color: 'var(--color-green)', bg: 'var(--color-green-l)' },
  aula: { label: 'Aula', color: 'var(--color-amber)', bg: 'var(--color-amber-l)' },
  reserva: { label: 'Reserva', color: 'var(--color-blue)', bg: 'var(--color-blue-l)' },
  conflito: { label: 'Conflito', color: 'var(--color-red)', bg: 'var(--color-red-l)' },
};

// Tipo de EVENTO dentro da coluna Eventos — label unificado (decisão de
// produto: aula e reserva mostram o mesmo texto "Aula", indistinguíveis
// aqui). Mantém o Record completo por compatibilidade de tipo (SalaEvento
// ainda tem os 2 valores reais de `tipo`), só o VALOR mudou. Cor também
// já era neutra (cinza) antes disso — não reaproveita a paleta vermelho/
// âmbar de RoomAvailabilityPanel, pra não competir com o badge de Status
// na mesma linha. Com os dois tipos agora textualmente iguais, a coluna
// Professor é a única forma visual de diferenciar aula (sem professor,
// vem do Schedule) de reserva (com professor, vem do Reservation).
export const TIPO_LABEL: Record<SalaEvento['tipo'], string> = {
  aula: 'Aula',
  reserva: 'Aula',
};

const STATUS_ORDER: Record<RoomStatus, number> = {
  conflito: 0,
  aula: 1,
  reserva: 2,
  livre: 3,
};

// Pura e exportada — ordena conflito > aula > reserva > livre, depois por
// nome de sala. Testável sem renderizar (o projeto não usa
// @testing-library/react — ver applyScheduleFilters.ts pro mesmo padrão).
export function sortSalas(salas: DisponibilidadeSala[]): DisponibilidadeSala[] {
  return [...salas].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.sala.localeCompare(b.sala),
  );
}

export type OccupancyViewState = 'loading' | 'empty' | 'data';

// Pura e exportada — decide qual dos 3 ramos de renderização o componente
// segue. Extraída pra ser testável em isolamento (mesmo motivo acima).
export function getViewState(salas: DisponibilidadeSala[], isLoading: boolean): OccupancyViewState {
  if (isLoading) return 'loading';
  if (salas.length === 0) return 'empty';
  return 'data';
}

export function OccupancyUnified({ salas, isLoading }: OccupancyUnifiedProps): JSX.Element {
  const viewState = getViewState(salas, isLoading);

  return (
    <div style={containerStyle} aria-label="Ocupação de hoje">
      <div style={headerStyle}>
        <span style={titleStyle}>Ocupação de hoje</span>
        {viewState !== 'loading' && (
          <span style={countBadgeStyle}>
            {salas.length} sala{salas.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {viewState === 'loading' ? (
        <div>
          {[1, 2, 3, 4, 5].map(i => (
            <SkeletonRow key={i} />
          ))}
          <style>{`
            @keyframes skeletonPulse {
              0%, 100% { opacity: 1; }
              50% { opacity: .4; }
            }
          `}</style>
        </div>
      ) : viewState === 'empty' ? (
        <div style={emptyStyle}>
          <p style={emptyTitleStyle}>Nenhuma sala encontrada</p>
        </div>
      ) : (
        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, minWidth: '140px' }}>Sala</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Professor</th>
                <th style={thStyle}>Eventos</th>
              </tr>
            </thead>
            <tbody>
              {sortSalas(salas).map(sala => {
                const statusStyle = STATUS_STYLE[sala.status];
                const isFree = sala.eventos.length === 0;
                return (
                  <tr key={sala.sala} style={{ ...trStyle, opacity: isFree ? 0.6 : 1 }}>
                    <td style={{ ...tdStyle, fontWeight: 600, minWidth: '140px' }}>{sala.sala}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          ...badgeStyle,
                          background: statusStyle.bg,
                          color: statusStyle.color,
                        }}
                      >
                        {statusStyle.label}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {isFree ? (
                        <span style={freeTextStyle}>—</span>
                      ) : (
                        <div style={eventsListStyle}>
                          {sala.eventos.map((ev, idx) => (
                            <div
                              key={`prof-${ev.tipo}-${ev.inicio}-${idx}`}
                              style={professorRowStyle}
                            >
                              {ev.professor ?? '—'}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {isFree ? (
                        <span style={freeTextStyle}>Livre o dia todo</span>
                      ) : (
                        <div style={eventsListStyle}>
                          {sala.eventos.map((ev, idx) => {
                            // Aula: só turma (como sempre). Reserva: professor + turma
                            // juntos quando a reserva tem turma ("Professor · Turma"),
                            // senão só professor (comportamento anterior preservado).
                            const detalhe =
                              ev.tipo === 'aula'
                                ? ev.turma
                                : ev.turma
                                  ? `${ev.professor} · ${ev.turma}`
                                  : ev.professor;
                            return (
                              <div key={`${ev.tipo}-${ev.inicio}-${idx}`} style={eventChipStyle}>
                                <div style={eventChipTopRowStyle}>
                                  <span style={eventTimeStyle}>
                                    {ev.inicio}–{ev.fim}
                                  </span>
                                  {detalhe && <span style={eventDetailStyle}>{detalhe}</span>}
                                </div>
                                <span style={tipoTagStyle}>{TIPO_LABEL[ev.tipo]}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Skeleton row (padrão de ScheduleSidebar.tsx) ──────────────────────
function SkeletonRow(): JSX.Element {
  return (
    <div style={skeletonRowStyle}>
      {[30, 15, 45].map((w, i) => (
        <div
          key={i}
          style={{
            height: 12,
            width: `${w}%`,
            borderRadius: 4,
            background: 'var(--color-border)',
            animation: 'skeletonPulse 1.2s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  );
}

// ── Styles (tokens do DS apenas) ──────────────────────────────────────

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-s)',
  padding: '16px',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
};

const titleStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: '13px',
  color: 'var(--color-text)',
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

const skeletonRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  padding: '10px 14px',
  borderBottom: '1px solid var(--color-border)',
};

const emptyStyle: CSSProperties = {
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
  color: 'var(--color-muted)',
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
  transition: 'opacity 120ms',
};

const tdStyle: CSSProperties = {
  padding: '12px 16px',
  color: 'var(--color-text)',
  verticalAlign: 'top',
};

const badgeStyle: CSSProperties = {
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 600,
  padding: '3px 10px',
  borderRadius: 20,
  whiteSpace: 'nowrap',
};

const freeTextStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-subtle)',
  fontStyle: 'italic',
};

const eventsListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

// Coluna Professor — mesmo container flex/gap de eventsListStyle (pra
// empilhar 1 linha por evento em paralelo aos chips da coluna Eventos),
// mas cada linha aqui é texto solto (sem chip). minHeight aproxima a
// altura real de um eventChipStyle de 2 linhas (horário + detalhe, o caso
// comum já que aula quase sempre tem turma e reserva quase sempre tem
// professor): padding 6px*2 + borda 1px*2 + linha de horário ~20px +
// linha de detalhe ~16px ≈ 46px. Não é alinhamento pixel-perfect
// garantido (chips de 1 linha ficam mais baixos que o esperado), mas é
// a aproximação mais estável sem medir DOM em runtime.
const professorRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minHeight: '46px',
  fontSize: '12px',
  color: 'var(--color-text)',
};

// Cada evento vira um chip com fundo próprio — mais contraste que texto
// corrido, mesma linguagem visual de EntryRow em ScheduleSidebar.tsx.
const eventChipStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-s)',
  padding: '6px 10px',
};

const eventChipTopRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '3px',
};

// Neutro (cinza) — ver comentário de TIPO_LABEL acima sobre por que não
// reaproveita a paleta vermelho/âmbar de RoomAvailabilityPanel.
const tipoTagStyle: CSSProperties = {
  display: 'inline-block',
  alignSelf: 'flex-start',
  fontSize: '10px',
  fontWeight: 700,
  padding: '1px 7px',
  borderRadius: 20,
  background: 'var(--color-bg)',
  color: 'var(--color-muted)',
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const eventTimeStyle: CSSProperties = {
  fontFamily: 'DM Sans, system-ui, sans-serif',
  fontSize: '14px',
  fontWeight: 500,
  letterSpacing: '.01em',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--color-text)',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const eventDetailStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
  minWidth: 0,
};
