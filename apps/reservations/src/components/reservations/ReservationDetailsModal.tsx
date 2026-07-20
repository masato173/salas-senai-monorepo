import { useEffect, useState, type CSSProperties } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { isRangeReservation, type ReservationDetails } from './reservationToEvent';
import { ReservationForm, type ReservationFormService } from './ReservationForm';
import { EditSelectedView } from './EditSelectedView';
import type {
  BackendError,
  UpdateReservationSelectedRequest,
  UpdateReservationSelectedResponse,
} from '../../services/apiTypes';

// Sub-etapa 4.2a — modal apresentacional puro.
// Sub-etapa 4.2b — fluxo de cancelamento em 2 cliques + owner-check preventivo.
// Sprint 4 Fase B — selo "Período" via isRangeReservation.
// Sprint 4 Fase D3 — modal vira CONTAINER LEVE com 3 views:
//   • details     — view atual (default).
//   • pick-scope  — só em reservas de grupo, pergunta "Só esta" vs "Todas do grupo".
//   • form-edit   — embute o ReservationForm em modo edit-single OU edit-group.
//
// Estados de dados (cancel mutation, lista, refetch) continuam vivendo na página.
// Modal só carrega estados de UI (view, editMode, justSaved, confirming).

type ModalView = 'details' | 'pick-scope' | 'form-edit';
type EditMode = 'edit-single' | 'edit-group' | 'edit-selected';

// Sprint 4 D4.4 — estende ReservationFormService com updateReservationSelected.
// O método foi adicionado ao AppsScriptService (appsScript.ts) na Fase D4.1,
// mas a interface local ReservationFormService (no ReservationForm) não foi
// atualizada. Estender aqui evita tocar o form (brief). O service real
// construído por createAppsScriptService já satisfaz este tipo.
interface ReservationDetailsModalService extends ReservationFormService {
  updateReservationSelected: (
    req: UpdateReservationSelectedRequest,
  ) => Promise<UpdateReservationSelectedResponse>;
}

interface ReservationDetailsModalProps {
  reservation: ReservationDetails | null;
  onClose: () => void;

  currentUserEmail: string;
  onConfirmCancel: (id: string) => void;
  cancelStatus: 'idle' | 'loading' | 'success' | 'error';
  cancelError: BackendError | null;
  onCancelReset: () => void;

  // Sprint 4 D3 — wiring de edit:
  service: ReservationDetailsModalService;
  userId: string;
  groupDates?: string[]; // datas do grupo (filtradas ACTIVE), pro modo edit-group
  // Sprint 4 D4.4 — wiring do C3 (edit-selected). `| undefined` explícito pra
  // aceitar groupIdMap={undefined} na chamada sem violar exactOptionalPropertyTypes.
  groupIdMap?: Record<string, string> | undefined;
  onEditSuccess: () => void; // página dispara list.refetch()
  // Role do usuário logado — COORDENADOR e ADMIN podem cancelar/editar qualquer reserva
  userRole?: string;
}

export function ReservationDetailsModal({
  reservation,
  onClose,
  currentUserEmail,
  onConfirmCancel,
  cancelStatus,
  cancelError,
  onCancelReset,
  service,
  userId,
  groupDates,
  groupIdMap,
  onEditSuccess,
  userRole,
}: ReservationDetailsModalProps) {
  const [confirming, setConfirming] = useState(false);
  const [view, setView] = useState<ModalView>('details');
  const [editMode, setEditMode] = useState<EditMode | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // Reset todos os estados internos quando a reserva selecionada muda (clique em outro evento).
  useEffect(() => {
    setConfirming(false);
    setView('details');
    setEditMode(null);
    setJustSaved(false);
  }, [reservation?.id]);

  // Quando erro do cancel chega, sai do confirming pra mostrar faixa de erro com botões idle.
  useEffect(() => {
    if (cancelStatus === 'error') setConfirming(false);
  }, [cancelStatus]);

  // Feedback de sucesso ✓ verde por 1.5s pos edit-success → refetch + close.
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => {
      onEditSuccess();
      onClose();
    }, 1500);
    return () => clearTimeout(t);
  }, [justSaved, onEditSuccess, onClose]);

  if (!reservation) return null;

  const { id, sala, data, inicio, fim, professor, turma, observacao, createdBy, groupId } =
    reservation;
  const isOwner = createdBy === currentUserEmail;
  // COORDENADOR e ADMIN podem cancelar/editar qualquer reserva
  const canManage = isOwner || userRole === 'COORDENADOR' || userRole === 'ADMIN';
  const isLoading = cancelStatus === 'loading';
  const isRange = id !== undefined && isRangeReservation(id, groupId);
  const editDisabled = !canManage || isLoading || !id;

  function handleEdit(): void {
    if (editDisabled) return;
    if (isRange) {
      setView('pick-scope');
    } else {
      setEditMode('edit-single');
      setView('form-edit');
    }
  }
  function handlePickScope(m: EditMode): void {
    setEditMode(m);
    setView('form-edit');
  }
  function handleBackToDetails(): void {
    setView('details');
    setEditMode(null);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,.4)',
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-s)',
          padding: '24px',
          width: 'min(520px, 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {justSaved ? (
          // ── Feedback ✓ verde 1.5s pos sucesso ────────────────────
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              padding: '24px 8px',
            }}
          >
            <CheckCircle2 size={40} style={{ color: 'var(--color-green)' }} />
            <p
              style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: 'var(--color-green)' }}
            >
              Reserva atualizada com sucesso!
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-muted)' }}>Fechando…</p>
          </div>
        ) : view === 'pick-scope' ? (
          // ── View: escolha "Só esta" vs "Todas do grupo" ─────────
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <h2
                style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}
              >
                Editar reserva do grupo
              </h2>
              <span style={badgeStyle}>Período</span>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text)' }}>
              Esta reserva faz parte de um grupo de{' '}
              <strong>{groupDates?.length ?? '?'} datas</strong>. O que você quer editar?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handlePickScope('edit-single')}
                style={pickScopeButtonStyle}
              >
                Só esta reserva ({formatDataBR(data)})
              </button>
              <button
                type="button"
                onClick={() => handlePickScope('edit-selected')}
                style={pickScopeButtonStyle}
              >
                Algumas datas do grupo
              </button>
              <button
                type="button"
                onClick={() => handlePickScope('edit-group')}
                style={pickScopeButtonStyle}
              >
                Todas do grupo ({groupDates?.length ?? '?'} datas)
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={handleBackToDetails} style={neutralButtonStyle}>
                Voltar
              </button>
            </div>
          </>
        ) : view === 'form-edit' && editMode === 'edit-selected' ? (
          // ── View: EditSelectedView (Sprint 4 D4.4 — caso C3) ────
          <>
            <h2
              style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}
            >
              Algumas datas do grupo
            </h2>

            <EditSelectedView
              groupDates={groupDates ?? []}
              groupIdMap={groupIdMap ?? {}}
              salaAtual={sala}
              inicioAtual={inicio}
              fimAtual={fim}
              turmaAtual={turma}
              observacaoAtual={observacao}
              userEmail={currentUserEmail}
              service={service}
              onSuccess={() => setJustSaved(true)}
              onCancel={handleBackToDetails}
            />
          </>
        ) : view === 'form-edit' && editMode && editMode !== 'edit-selected' && id ? (
          // ── View: ReservationForm embutido (D2) ─────────────────
          // Guard `editMode !== 'edit-selected'` é puramente TS narrowing —
          // a branch C3 acima já intercepta esse caso. Comportamento idêntico.
          <>
            <h2
              style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}
            >
              {editMode === 'edit-single' ? 'Editar reserva' : 'Editar grupo'}
            </h2>

            <ReservationForm
              key={`${id}:${editMode}`}
              roomId={sala}
              salaName={sala}
              userId={userId}
              userEmail={currentUserEmail}
              professor={professor}
              turma={turma}
              service={service}
              mode={editMode}
              initialValues={{
                id,
                groupId,
                data,
                inicio,
                fim,
                observacao,
                ...(editMode === 'edit-group' && groupDates !== undefined && { groupDates }),
              }}
              onSuccess={() => setJustSaved(true)}
              onCancel={handleBackToDetails}
            />
          </>
        ) : (
          // ── View: details (default) ─────────────────────────────
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <h2
                style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}
              >
                Detalhes da reserva
              </h2>
              {isRange && <span style={badgeStyle}>Período</span>}
            </div>

            <dl
              style={{
                margin: 0,
                display: 'grid',
                gridTemplateColumns: 'max-content 1fr',
                rowGap: '8px',
                columnGap: '16px',
                fontSize: '13px',
              }}
            >
              <dt style={dtStyle}>Sala</dt> <dd style={ddStyle}>{sala}</dd>
              <dt style={dtStyle}>Data</dt> <dd style={ddStyle}>{formatDataBR(data)}</dd>
              <dt style={dtStyle}>Horário</dt>{' '}
              <dd style={ddStyle}>
                {inicio} – {fim}
              </dd>
              <dt style={dtStyle}>Professor</dt> <dd style={ddStyle}>{professor}</dd>
              <dt style={dtStyle}>Turma</dt> <dd style={ddStyle}>{turma || '—'}</dd>
              <dt style={dtStyle}>Observação</dt> <dd style={ddStyle}>{observacao || '—'}</dd>
            </dl>

            {/* Faixa de erro do cancel (padrão ReservationForm) */}
            {cancelError && !confirming && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  borderRadius: 'var(--radius-s)',
                  border: '1px solid var(--color-red)',
                  background: 'var(--color-red-l)',
                  padding: '10px 14px',
                }}
              >
                <AlertCircle
                  size={14}
                  style={{ color: 'var(--color-red)', flexShrink: 0, marginTop: '1px' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--color-red)' }}>
                  {cancelError.message}
                </span>
              </div>
            )}

            {/* Indicador de loading do cancel */}
            {isLoading && (
              <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Cancelando…</span>
            )}

            <div
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}
            >
              {confirming ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onCancelReset();
                      setConfirming(false);
                    }}
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
                    onClick={handleEdit}
                    disabled={editDisabled}
                    title={
                      !canManage ? 'Sem permissão para editar' : isLoading ? 'Aguarde…' : undefined
                    }
                    style={{
                      ...primaryButtonStyle,
                      cursor: editDisabled ? 'not-allowed' : 'pointer',
                      opacity: editDisabled ? 0.5 : 1,
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onCancelReset();
                      setConfirming(true);
                    }}
                    disabled={!canManage || isLoading || !id}
                    title={!canManage ? 'Sem permissão para cancelar' : undefined}
                    style={{
                      ...cancelIntentButtonStyle,
                      cursor: !canManage || isLoading ? 'not-allowed' : 'pointer',
                      opacity: !canManage || isLoading ? 0.5 : 1,
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
          </>
        )}
      </div>
    </div>
  );
}

// Selo "Período" (Sprint 4 Fase B): mesmo padrão visual do chip "X registros"
// em pages/Reservas/index.tsx — reusa tokens existentes, sem cor nova.
const badgeStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  padding: '3px 10px',
  borderRadius: 20,
  background: 'var(--color-blue-l)',
  color: 'var(--color-blue)',
};

const dtStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-muted)',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  alignSelf: 'center',
};
const ddStyle: CSSProperties = { margin: 0, color: 'var(--color-text)' };

const neutralButtonStyle: CSSProperties = {
  height: '32px',
  padding: '0 14px',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  fontFamily: 'inherit',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};

// Acao primaria (Editar): brand color cheio. Sprint 4 D3.
const primaryButtonStyle: CSSProperties = {
  height: '32px',
  padding: '0 14px',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-brand)',
  color: '#fff',
  border: '1px solid var(--color-brand)',
  fontFamily: 'inherit',
  fontSize: '13px',
  fontWeight: 600,
};

// Botao da view pick-scope (Sprint 4 D3): full width, neutro, ativo.
const pickScopeButtonStyle: CSSProperties = {
  width: '100%',
  textAlign: 'left',
  height: '44px',
  padding: '0 14px',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  fontFamily: 'inherit',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};

// Intenção destrutiva (passo 1): texto vermelho + borda vermelha sutil.
const cancelIntentButtonStyle: CSSProperties = {
  height: '32px',
  padding: '0 14px',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface)',
  color: 'var(--color-red)',
  border: '1px solid var(--color-red)',
  fontFamily: 'inherit',
  fontSize: '13px',
  fontWeight: 600,
};

// Confirmação destrutiva (passo 2): vermelho cheio, alarmante.
const destructiveButtonStyle: CSSProperties = {
  height: '32px',
  padding: '0 14px',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-red)',
  color: '#fff',
  border: '1px solid var(--color-red)',
  fontFamily: 'inherit',
  fontSize: '13px',
  fontWeight: 600,
};

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
