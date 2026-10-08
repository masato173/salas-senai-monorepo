import { type CSSProperties } from 'react';
import type { DisponibilidadeSala, RoomStatus, SalaEvento } from '../../types';
import { professorLabel } from './professorNames';

// Unificação Schedule+Reservation — visão do dia via GET /availability
// (DisponibilidadeSala.eventos já mistura tipo:'aula' e tipo:'reserva').
// Substitui a antiga tabela histórica de Schedule na Dashboard (ver
// OccupancyDashboard, que migrou para /admin/sync).

interface OccupancyUnifiedProps {
  salas: DisponibilidadeSala[];
  isLoading: boolean;
  // Issue 5 (fase 2) — usuário logado e nomes de GET /reservations/day ainda
  // carregando: chip de reserva sem nome mostra um skeleton curto no lugar.
  namesLoading?: boolean;
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
// na mesma linha. Com os dois tipos agora textualmente iguais, o que
// diferencia aula de reserva é o detalhe do chip: aula mostra a turma,
// reserva mostra "Reserva · Turma". (Antes era a coluna Professor, removida
// porque /availability é público e não pode expor nome de pessoa.)
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

// Nome do professor responsável (dono da reserva) — só chega aqui pra
// usuário autenticado (ver professorNames.ts). Texto React (escapado), nome
// longo truncado por CSS com o nome completo no `title`.
export function ProfessorTag({ name }: { name: string }): JSX.Element {
  const label = professorLabel(name);
  return (
    <span style={professorTagStyle} title={label}>
      {label}
    </span>
  );
}

const SKELETON_KEYFRAMES = `
  @keyframes skeletonPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: .4; }
  }
`;

export function OccupancyUnified({
  salas,
  isLoading,
  namesLoading = false,
}: OccupancyUnifiedProps): JSX.Element {
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
          <style>{SKELETON_KEYFRAMES}</style>
        </div>
      ) : viewState === 'empty' ? (
        <div style={emptyStyle}>
          <p style={emptyTitleStyle}>Nenhuma sala encontrada</p>
        </div>
      ) : (
        <div style={tableWrapperStyle}>
          {namesLoading && <style>{SKELETON_KEYFRAMES}</style>}
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, minWidth: '140px' }}>Sala</th>
                <th style={thStyle}>Status</th>
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
                        <span style={freeTextStyle}>Livre o dia todo</span>
                      ) : (
                        <div style={eventsListStyle}>
                          {sala.eventos.map((ev, idx) => {
                            // Aula: só turma. Reserva: "Reserva · Turma" (ou só
                            // "Reserva"). O nome do professor não vem de
                            // /availability (público): é anexado pelo Dashboard
                            // só pra usuário logado (ev.professor).
                            const detalhe =
                              ev.tipo === 'aula'
                                ? ev.turma
                                : ev.turma
                                  ? `Reserva · ${ev.turma}`
                                  : 'Reserva';
                            return (
                              <div key={`${ev.tipo}-${ev.inicio}-${idx}`} style={eventChipStyle}>
                                <div style={eventChipTopRowStyle}>
                                  <span style={eventTimeStyle}>
                                    {ev.inicio}–{ev.fim}
                                  </span>
                                  {detalhe && <span style={eventDetailStyle}>{detalhe}</span>}
                                </div>
                                {ev.tipo === 'reserva' &&
                                  (ev.professor !== undefined ? (
                                    <ProfessorTag name={ev.professor} />
                                  ) : namesLoading ? (
                                    <span style={professorSkeletonStyle} aria-hidden="true" />
                                  ) : null)}
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

const professorTagStyle: CSSProperties = {
  display: 'block',
  maxWidth: '100%',
  fontSize: '12px',
  color: 'var(--color-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const professorSkeletonStyle: CSSProperties = {
  display: 'block',
  height: 10,
  width: '45%',
  borderRadius: 4,
  background: 'var(--color-border)',
  animation: 'skeletonPulse 1.2s ease-in-out infinite',
};
