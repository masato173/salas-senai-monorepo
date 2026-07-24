import { type CSSProperties } from 'react';
import { AlertCircle } from 'lucide-react';
import { useMyReservations, type MyReservationStatus } from '../../hooks/useMyReservations';
import { useRealtimeSocket } from '../../hooks/useRealtimeSocket';

// Minha Agenda — GET /reservations?mine=true. Mostra as reservas do usuário
// logado independente de quem criou (proxy do coordenador grava o userId
// do professor — "minhas" reflete isso corretamente, sem trabalho extra).
// Mesmo padrão visual de OccupancyUnified.tsx (container/header/tabela) e
// mesma paleta de status de ReservationList.tsx (PENDING=amber, APPROVED=
// green, REJECTED=red, CANCELLED=subtle).

const STATUS_STYLE: Record<MyReservationStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pendente', color: 'var(--color-amber)', bg: 'var(--color-amber-l)' },
  APPROVED: { label: 'Aprovada', color: 'var(--color-green)', bg: 'var(--color-green-l)' },
  REJECTED: { label: 'Rejeitada', color: 'var(--color-red)', bg: 'var(--color-red-l)' },
  CANCELLED: { label: 'Cancelada', color: 'var(--color-subtle)', bg: 'var(--color-surface-2)' },
};

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function MinhaAgendaPage(): JSX.Element {
  const { data, loading, error, refetch } = useMyReservations();

  // F7.3b — realtime: aprovação/rejeição/cancelamento refletem sem F5.
  useRealtimeSocket({
    onReservationEvent: (_event, _payload) => {
      refetch();
    },
  });

  const sorted = [...data].sort(
    (a, b) => b.date.localeCompare(a.date) || a.inicio.localeCompare(b.inicio),
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Minha Agenda</h1>
          <p className="page-subtitle">Suas reservas, independente de quem criou</p>
        </div>
      </div>

      <div style={containerStyle} aria-label="Minhas reservas">
        <div style={headerStyle}>
          <span style={titleStyle}>Reservas</span>
          {!loading && (
            <span style={countBadgeStyle}>
              {data.length} {data.length === 1 ? 'reserva' : 'reservas'}
            </span>
          )}
        </div>

        {error && (
          <div role="alert" style={errorStyle}>
            <AlertCircle size={14} style={{ color: 'var(--color-red)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '12px', color: 'var(--color-red)' }}>{error}</span>
            <button type="button" onClick={() => refetch()} style={retryButtonStyle}>
              Tentar novamente
            </button>
          </div>
        )}

        {loading ? (
          <div>
            {[1, 2, 3].map(i => (
              <SkeletonRow key={i} />
            ))}
            <style>{`
              @keyframes skeletonPulse {
                0%, 100% { opacity: 1; }
                50% { opacity: .4; }
              }
            `}</style>
          </div>
        ) : sorted.length === 0 ? (
          <div style={emptyStyle}>
            <p style={emptyTitleStyle}>Nenhuma reserva encontrada</p>
          </div>
        ) : (
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Data</th>
                  <th style={thStyle}>Sala</th>
                  <th style={thStyle}>Turma</th>
                  <th style={thStyle}>Horário</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => {
                  const s = STATUS_STYLE[r.status];
                  return (
                    <tr key={r.id} style={trStyle}>
                      <td style={tdStyle}>{formatDataBR(r.date)}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{r.room?.name ?? '—'}</td>
                      <td style={{ ...tdStyle, color: 'var(--color-muted)' }}>{r.turma || '—'}</td>
                      <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                        {r.inicio}–{r.fim}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ ...badgeStyle, background: s.bg, color: s.color }}>
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Skeleton row (padrão de OccupancyUnified.tsx) ─────────────────────
function SkeletonRow(): JSX.Element {
  return (
    <div style={skeletonRowStyle}>
      {[15, 25, 15, 15, 15].map((w, i) => (
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

// ── Styles (tokens do DS apenas) — espelha OccupancyUnified.tsx ────────

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

const errorStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 14px',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-red-l)',
  border: '1px solid var(--color-red)',
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
};

const tdStyle: CSSProperties = {
  padding: '12px 16px',
  color: 'var(--color-text)',
};

const badgeStyle: CSSProperties = {
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 600,
  padding: '3px 10px',
  borderRadius: 20,
  whiteSpace: 'nowrap',
};
