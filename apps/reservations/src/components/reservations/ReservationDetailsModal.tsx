import type { CSSProperties } from 'react';
import type { ReservationDetails } from './reservationToEvent';

// Sub-etapa 4.2a — modal apresentacional puro.
// Sem botão Cancelar (4.2b). Click no backdrop ou botão Fechar dispara onClose.

interface ReservationDetailsModalProps {
  reservation: ReservationDetails | null;
  onClose:     () => void;
}

export function ReservationDetailsModal({ reservation, onClose }: ReservationDetailsModalProps) {
  if (!reservation) return null;

  const { sala, data, inicio, fim, professor, observacao } = reservation;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,.4)',
        display: 'grid', placeItems: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-s)',
          padding: '24px',
          width: 'min(420px, 100%)',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
          Detalhes da reserva
        </h2>

        <dl style={{
          margin: 0, display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          rowGap: '8px', columnGap: '16px', fontSize: '13px',
        }}>
          <dt style={dtStyle}>Sala</dt>       <dd style={ddStyle}>{sala}</dd>
          <dt style={dtStyle}>Data</dt>       <dd style={ddStyle}>{formatDataBR(data)}</dd>
          <dt style={dtStyle}>Horário</dt>    <dd style={ddStyle}>{inicio} – {fim}</dd>
          <dt style={dtStyle}>Professor</dt>  <dd style={ddStyle}>{professor}</dd>
          <dt style={dtStyle}>Observação</dt> <dd style={ddStyle}>{observacao || '—'}</dd>
        </dl>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: '32px', padding: '0 14px',
              borderRadius: 'var(--radius-s)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

const dtStyle: CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)',
  textTransform: 'uppercase', letterSpacing: '.05em',
  alignSelf: 'center',
};
const ddStyle: CSSProperties = { margin: 0, color: 'var(--color-text)' };

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
