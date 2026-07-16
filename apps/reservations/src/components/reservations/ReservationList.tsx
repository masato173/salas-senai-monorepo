import { useMemo, type CSSProperties } from 'react';
import type { CreatedReservationRow } from '../../services/appsScript';

interface ReservationListProps {
  reservations?: CreatedReservationRow[];
  showApproval?: boolean;
  userId?: string;
}

type Turno = 'M' | 'V' | 'N';

function inferirTurno(inicio: string): Turno {
  const h = parseInt(inicio.split(':')[0], 10);
  if (h < 13) return 'M';
  if (h < 18) return 'V';
  return 'N';
}

const TURNO_ORDER: Turno[] = ['M', 'V', 'N'];

const TURNO_LABEL: Record<Turno, string> = {
  M: 'Matutino',
  V: 'Vespertino',
  N: 'Noturno',
};

const TURNO_COLOR: Record<Turno, { bg: string; color: string }> = {
  M: { bg: 'var(--color-green-l)', color: 'var(--color-green)' },
  V: { bg: 'var(--color-amber-l)', color: 'var(--color-amber)' },
  N: { bg: 'var(--color-blue-l)', color: 'var(--color-blue)' },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: 'var(--color-amber-l)', color: 'var(--color-amber)' },
  APPROVED: { bg: 'var(--color-green-l)', color: 'var(--color-green)' },
  REJECTED: { bg: 'var(--color-red-l)', color: 'var(--color-red)' },
  CANCELLED: { bg: 'var(--color-surface-2)', color: 'var(--color-subtle)' },
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
  CANCELLED: 'Cancelada',
};

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function ReservationList({
  reservations,
  showApproval = false,
  userId,
}: ReservationListProps) {
  // showApproval mantido na interface para backward compat — aprovação via /aprovacoes
  void showApproval;

  const grouped = useMemo(() => {
    const items = (reservations ?? [])
      .filter(r => r.status === 'APPROVED')
      .filter(r => !userId || r.createdBy === userId)
      .sort((a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio));

    const map: Record<string, CreatedReservationRow[]> = { M: [], V: [], N: [] };
    for (const r of items) {
      const turno = inferirTurno(r.inicio);
      map[turno].push(r);
    }
    return TURNO_ORDER.filter(t => map[t].length > 0).map(t => ({
      turno: t,
      label: TURNO_LABEL[t],
      color: TURNO_COLOR[t],
      items: map[t],
    }));
  }, [reservations, userId]);

  if (grouped.length === 0) {
    return (
      <div
        style={{
          padding: '32px 16px',
          textAlign: 'center',
          color: 'var(--color-muted)',
          fontSize: '13px',
        }}
      >
        Nenhuma reserva encontrada.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {grouped.map(({ turno, label, color, items }) => (
        <div key={turno}>
          <div
            style={{
              padding: '8px 16px',
              background: 'var(--color-surface-2)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 10px',
                borderRadius: 20,
                background: color.bg,
                color: color.color,
              }}
            >
              {label}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
              {items.length} {items.length === 1 ? 'reserva' : 'reservas'}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Data', 'Sala', 'Turma', 'Horário', 'Status'].map(h => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--color-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(r => {
                  const sc = STATUS_COLORS[r.status] ?? STATUS_COLORS['PENDING'];
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={tdStyle}>{formatDataBR(r.data)}</td>
                      <td style={tdStyle}>{r.sala}</td>
                      <td style={{ ...tdStyle, color: 'var(--color-muted)' }}>{r.turma || '—'}</td>
                      <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                        {r.inicio}–{r.fim}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 600,
                            background: sc.bg,
                            color: sc.color,
                          }}
                        >
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

const tdStyle: CSSProperties = {
  padding: '8px 12px',
  color: 'var(--color-text)',
};
