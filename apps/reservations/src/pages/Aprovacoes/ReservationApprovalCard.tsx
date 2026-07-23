import { Check, X } from 'lucide-react';
import type { CreatedReservationRow } from '../../services/apiTypes';

interface ReservationApprovalCardProps {
  reservation: CreatedReservationRow;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

interface StatusStyle {
  bg: string;
  fg: string;
  label: string;
}

const STATUS_STYLE: Record<string, StatusStyle> = {
  PENDING: { bg: 'var(--color-amber-l)', fg: 'var(--color-amber)', label: 'Pendente' },
  APPROVED: { bg: 'var(--color-green-l)', fg: 'var(--color-green)', label: 'Aprovada' },
  REJECTED: { bg: 'var(--color-red-l)', fg: 'var(--color-red)', label: 'Rejeitada' },
  CANCELLED: { bg: 'var(--color-surface-2)', fg: 'var(--color-muted)', label: 'Cancelada' },
};

// YYYY-MM-DD → DD/MM/YYYY
function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

// ISO → "agora" | "há N min" | "há Nh" | "há N dia(s)"
function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'há 1 dia' : `há ${days} dias`;
}

export function ReservationApprovalCard({
  reservation,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: ReservationApprovalCardProps): JSX.Element {
  const busy = isApproving || isRejecting;
  const statusStyle = STATUS_STYLE[reservation.status] ?? {
    bg: 'var(--color-surface-2)',
    fg: 'var(--color-muted)',
    label: reservation.status,
  };

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-s)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>
            {reservation.sala}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 10px',
              borderRadius: 999,
              background: statusStyle.bg,
              color: statusStyle.fg,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '.02em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {statusStyle.label}
          </span>
        </div>

        {reservation.status === 'PENDING' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => onReject(reservation.id)}
              disabled={busy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 32,
                padding: '0 14px',
                borderRadius: 'var(--radius-s)',
                background: 'transparent',
                border: '1px solid var(--color-red)',
                color: 'var(--color-red)',
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: isRejecting ? 0.65 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              <X size={13} strokeWidth={2.5} aria-hidden="true" />
              {isRejecting ? 'Rejeitando...' : 'Rejeitar'}
            </button>
            <button
              type="button"
              onClick={() => onApprove(reservation.id)}
              disabled={busy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 32,
                padding: '0 14px',
                borderRadius: 'var(--radius-s)',
                background: 'var(--color-green)',
                border: '1px solid var(--color-green)',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: isApproving ? 0.65 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              <Check size={13} strokeWidth={2.5} aria-hidden="true" />
              {isApproving ? 'Aprovando...' : 'Aprovar'}
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          fontSize: 12.5,
          color: 'var(--color-muted)',
        }}
      >
        <span>
          {reservation.professor !== '' ? reservation.professor : 'Professor não identificado'}
        </span>
        <span style={{ color: 'var(--color-subtle)' }} aria-hidden="true">
          ·
        </span>
        <span>{formatDate(reservation.data)}</span>
        <span style={{ color: 'var(--color-subtle)' }} aria-hidden="true">
          ·
        </span>
        <span
          style={{
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--color-text)',
          }}
        >
          {reservation.inicio} – {reservation.fim}
        </span>
      </div>

      <span style={{ fontSize: 11, color: 'var(--color-subtle)' }}>
        Solicitado {timeAgo(reservation.createdAt)}
      </span>
    </div>
  );
}
