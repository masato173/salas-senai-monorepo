import { useEffect, useState, type CSSProperties } from 'react';
import { AlertCircle } from 'lucide-react';
import type { ReservationDetails } from './reservationToEvent';
import type { BackendError } from '../../services/appsScript';

// Sub-etapa 4.2a — modal apresentacional puro.
// Sub-etapa 4.2b — adiciona fluxo de cancelamento em 2 cliques:
//   idle → "Cancelar reserva" → confirming → "Confirmar cancelamento" → onConfirmCancel
// Owner-check preventivo desabilita o botão se createdBy !== currentUserEmail (UX).
// Backend continua sendo a defesa real (FORBIDDEN tratado defensivamente).

interface ReservationDetailsModalProps {
  reservation: ReservationDetails | null;
  onClose:     () => void;

  currentUserEmail: string;
  onConfirmCancel:  (id: string) => void;
  cancelStatus:     'idle' | 'loading' | 'success' | 'error';
  cancelError:      BackendError | null;
  onCancelReset:    () => void;
}

export function ReservationDetailsModal({
  reservation,
  onClose,
  currentUserEmail,
  onConfirmCancel,
  cancelStatus,
  cancelError,
  onCancelReset,
}: ReservationDetailsModalProps) {
  const [confirming, setConfirming] = useState(false);

  // Reset confirming quando reservation muda (clique em outro evento).
  useEffect(() => {
    setConfirming(false);
  }, [reservation?.id]);

  // Quando erro chega do backend, sai do confirming pra mostrar faixa de erro com botões idle.
  useEffect(() => {
    if (cancelStatus === 'error') setConfirming(false);
  }, [cancelStatus]);

  if (!reservation) return null;

  const { id, sala, data, inicio, fim, professor, observacao, createdBy } = reservation;
  const isOwner   = createdBy === currentUserEmail;
  const isLoading = cancelStatus === 'loading';

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

        {/* Faixa de erro (padrão ReservationForm) */}
        {cancelError && !confirming && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '8px',
            borderRadius: 'var(--radius-s)', border: '1px solid var(--color-red)',
            background: 'var(--color-red-l)', padding: '10px 14px',
          }}>
            <AlertCircle size={14} style={{ color: 'var(--color-red)', flexShrink: 0, marginTop: '1px' }} />
            <span style={{ fontSize: '12px', color: 'var(--color-red)' }}>{cancelError.message}</span>
          </div>
        )}

        {/* Indicador de loading */}
        {isLoading && (
          <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
            Cancelando…
          </span>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          {confirming ? (
            <>
              <button
                type="button"
                onClick={() => { onCancelReset(); setConfirming(false); }}
                disabled={isLoading}
                style={{ ...neutralButtonStyle, opacity: isLoading ? 0.6 : 1 }}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => id && onConfirmCancel(id)}
                disabled={isLoading || !id}
                style={{
                  ...destructiveButtonStyle,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                Confirmar cancelamento
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { onCancelReset(); setConfirming(true); }}
                disabled={!isOwner || isLoading || !id}
                title={!isOwner ? 'Só quem criou pode cancelar' : undefined}
                style={{
                  ...cancelIntentButtonStyle,
                  cursor: (!isOwner || isLoading) ? 'not-allowed' : 'pointer',
                  opacity: (!isOwner || isLoading) ? 0.5 : 1,
                }}
              >
                Cancelar reserva
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                style={neutralButtonStyle}
              >
                Fechar
              </button>
            </>
          )}
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

const neutralButtonStyle: CSSProperties = {
  height: '32px', padding: '0 14px',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
  cursor: 'pointer',
};

// Intenção destrutiva (passo 1): texto vermelho + borda vermelha sutil.
const cancelIntentButtonStyle: CSSProperties = {
  height: '32px', padding: '0 14px',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface)',
  color: 'var(--color-red)',
  border: '1px solid var(--color-red)',
  fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
};

// Confirmação destrutiva (passo 2): vermelho cheio, alarmante.
const destructiveButtonStyle: CSSProperties = {
  height: '32px', padding: '0 14px',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-red)',
  color: '#fff',
  border: '1px solid var(--color-red)',
  fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
};

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
