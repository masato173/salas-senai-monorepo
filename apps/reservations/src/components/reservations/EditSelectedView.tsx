import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

import { SALAS } from '../../config';
import { validateTimeInput } from '../../validators/conflict';
import { useUpdateReservationSelected } from '../../hooks/useUpdateReservationSelected';
import { MiniCalendar } from './MiniCalendar';
import { TimePicker } from '../ui/TimePicker';
import { Select } from '../ui/Select';
import type { ReservationFormService } from './ReservationForm';
import type {
  UpdateReservationSelectedRequest,
  UpdateReservationSelectedResponse,
} from '../../services/apiTypes';

// Estende ReservationFormService localmente com updateReservationSelected.
// O método foi adicionado ao AppsScriptService (appsScript.ts) na Fase D4.1,
// mas ReservationFormService — interface local do ReservationForm — não foi
// atualizada (brief proíbe tocar aquele arquivo). O service real construído
// por createAppsScriptService já satisfaz este tipo (super-conjunto).
interface EditSelectedViewService extends ReservationFormService {
  updateReservationSelected: (
    req: UpdateReservationSelectedRequest,
  ) => Promise<UpdateReservationSelectedResponse>;
}

// Sprint 4 D4.3 — view que orquestra remanejamento de ocorrências SELECIONADAS
// de um grupo (caso C3: "ar quebrou, remaneja só algumas datas").
//
// Consome MiniCalendar (D4.2) pra seleção + useUpdateReservationSelected (D4.1)
// pro submit. O wiring no modal vem na D4.4.
//
// Restrições (rédea curta na frontend-design):
//   • Tokens existentes apenas (brand/surface/border/text/muted/red/red-l/
//     radius-s/shadow-s). Sem paleta nova.
//   • Estilos inline replicando padrão do ReservationForm/Modal — não toca
//     outros arquivos.
//   • Único elemento com personalidade visual é o MiniCalendar (D4.2);
//     aqui tudo fica quieto.

interface EditSelectedViewProps {
  groupDates: string[];
  groupIdMap: Record<string, string>; // data YYYY-MM-DD → id da ocorrência
  salaAtual: string;
  inicioAtual: string;
  fimAtual: string;
  turmaAtual: string;
  observacaoAtual: string;
  userEmail: string;
  service: EditSelectedViewService;
  onSuccess: () => void;
  onCancel: () => void;
}

export function EditSelectedView({
  groupDates,
  groupIdMap,
  salaAtual,
  inicioAtual,
  fimAtual,
  turmaAtual,
  observacaoAtual,
  userEmail,
  service,
  onSuccess,
  onCancel,
}: EditSelectedViewProps): JSX.Element {
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [sala, setSala] = useState<string>(salaAtual);
  const [inicio, setInicio] = useState<string>(inicioAtual);
  const [fim, setFim] = useState<string>(fimAtual);
  const [turma, setTurma] = useState<string>(turmaAtual);
  const [observacao, setObservacao] = useState<string>(observacaoAtual);
  const [errors, setErrors] = useState<string[]>([]);

  const mutation = useUpdateReservationSelected(service);

  const isLoading = mutation.status === 'loading';
  const totalGroup = groupDates.length;
  const totalSelected = selectedDates.length;
  const isCasoD = totalSelected > 0 && totalSelected === totalGroup;
  const isEmpty = totalSelected === 0;
  const submitDisabled = isEmpty || isCasoD || isLoading;

  // Lista de salas: SALAS oficial + salaAtual no topo se não estiver na lista
  // (defensivo pra salas removidas que ainda tem reservas vivas).
  const salasList = useMemo<string[]>(() => {
    const all: string[] = [...SALAS];
    if (salaAtual && !all.includes(salaAtual)) all.unshift(salaAtual);
    return all;
  }, [salaAtual]);
  const salaOptions = useMemo(() => salasList.map(s => ({ value: s, label: s })), [salasList]);

  const toggleData = useCallback((date: string): void => {
    setSelectedDates(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date].sort(),
    );
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();
      setErrors([]);

      // 1. Caso D — selecionou todas as ACTIVE do grupo.
      if (isCasoD) {
        setErrors([
          'Você selecionou todas as datas. Para editar o grupo inteiro, volte e use "Todas do grupo".',
        ]);
        return;
      }

      // 2. Vazio.
      if (isEmpty) {
        setErrors(['Selecione ao menos uma data.']);
        return;
      }

      // 3. Horário (passa a 1ª data selecionada como referência — igual C2 faz com groupDates[0]).
      const timeResult = validateTimeInput({ start: inicio, end: fim, date: selectedDates[0] });
      if (!timeResult.ok) {
        setErrors([timeResult.error ?? 'Horário inválido.']);
        return;
      }

      // 4. Sala (defensivo — o select sempre tem valor).
      if (!sala || !sala.trim()) {
        setErrors(['Selecione uma sala.']);
        return;
      }

      // 5. Traduz datas selecionadas em ids via groupIdMap.
      const ids: string[] = [];
      for (const d of selectedDates) {
        const id = groupIdMap[d];
        if (!id) {
          setErrors(['Inconsistência: datas selecionadas sem id no mapa do grupo.']);
          return;
        }
        ids.push(id);
      }

      // 6. Chama o hook (maxRetries:0 forçado dentro do hook — FLAG 1 do C3).
      try {
        const res = await mutation.mutate({
          userEmail,
          payload: { ids, sala, inicio, fim, turma, observacao },
        });

        if (res.ok) {
          onSuccess();
          return;
        }

        if (res.error?.code === 'CONFLICT') {
          const conflictDates = res.error.details?.conflicts ?? [];
          const shown = conflictDates.slice(0, 10).map(isoToBR).join(', ');
          const more = conflictDates.length - 10;
          const list = shown + (more > 0 ? ` (+${more} mais)` : '');
          setErrors([`Conflito em ${conflictDates.length} data(s): ${list}`]);
          return;
        }

        setErrors([res.error?.message ?? 'Falha ao remanejar selecionadas.']);
      } catch {
        setErrors(['Falha de conexão. Tente novamente.']);
      }
    },
    [
      isCasoD,
      isEmpty,
      selectedDates,
      groupIdMap,
      sala,
      inicio,
      fim,
      turma,
      observacao,
      userEmail,
      mutation,
      onSuccess,
    ],
  );

  const submitLabel = isLoading
    ? 'Enviando…'
    : totalSelected === 1
      ? 'Remanejar 1 data'
      : `Remanejar ${totalSelected} datas`;

  // Erros consolidados: validação local + hook.error (pra cobrir o caminho
  // em que o user re-submete depois de um erro persistente).
  const errorMessages: string[] = [...errors];
  if (errors.length === 0 && mutation.error) {
    errorMessages.push(mutation.error.message);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      <h3 style={titleStyle}>Remanejar datas selecionadas</h3>

      <MiniCalendar groupDates={groupDates} selectedDates={selectedDates} onToggle={toggleData} />

      <p style={counterStyle} aria-live="polite">
        <strong style={counterEmphasisStyle}>{totalSelected}</strong>
        {' de '}
        <strong style={counterEmphasisStyle}>{totalGroup}</strong>
        {totalGroup === 1 ? ' data selecionada' : ' datas selecionadas'}
      </p>

      {isCasoD && (
        <div role="alert" style={infoBoxStyle}>
          <AlertCircle size={14} style={infoIconStyle} aria-hidden="true" />
          <span style={infoTextStyle}>
            Você selecionou todas as datas. Para editar o grupo inteiro, volte e use
            {' "Todas do grupo"'}.
          </span>
        </div>
      )}

      <Field label="Sala *" htmlFor="esel-sala">
        <Select
          id="esel-sala"
          value={sala}
          onChange={setSala}
          options={salaOptions}
          disabled={isLoading}
        />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="Início *" htmlFor="esel-inicio" hint="HH:MM">
          <TimePicker id="esel-inicio" value={inicio} onChange={setInicio} disabled={isLoading} />
        </Field>
        <Field label="Fim *" htmlFor="esel-fim" hint="HH:MM">
          <TimePicker id="esel-fim" value={fim} onChange={setFim} disabled={isLoading} />
        </Field>
      </div>

      <Field label="Turma *" htmlFor="esel-turma">
        <input
          id="esel-turma"
          type="text"
          value={turma}
          onChange={e => setTurma(e.target.value)}
          disabled={isLoading}
          style={inputStyle}
        />
      </Field>

      <Field label="Observação" htmlFor="esel-obs">
        <input
          id="esel-obs"
          type="text"
          maxLength={200}
          value={observacao}
          onChange={e => setObservacao(e.target.value)}
          disabled={isLoading}
          style={inputStyle}
        />
        <span style={charCounterStyle}>{observacao.length}/200</span>
      </Field>

      {errorMessages.length > 0 && (
        <div role="alert" style={errorBoxStyle}>
          <AlertCircle size={14} style={errorIconStyle} aria-hidden="true" />
          <ul style={errorListStyle}>
            {errorMessages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
        <button
          type="submit"
          disabled={submitDisabled}
          style={{
            ...primaryButtonStyle,
            cursor: submitDisabled ? 'not-allowed' : 'pointer',
            opacity: submitDisabled ? 0.5 : 1,
          }}
        >
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={isLoading} style={neutralButtonStyle}>
          Voltar
        </button>
      </div>
    </form>
  );
}

// ── Helpers visuais locais ────────────────────────────────────
// Replicam o padrão do ReservationForm. Brief proíbe tocar aquele arquivo
// pra exportar o Field, então duplicação consciente aqui.

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}

function Field({ label, htmlFor, hint, children }: FieldProps): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label htmlFor={htmlFor} style={labelStyle}>
        {label}
        {hint && (
          <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({hint})</span>
        )}
      </label>
      {children}
    </div>
  );
}

function isoToBR(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// ── Styles (CSSProperties — padrão do ReservationForm/Modal) ──

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '15px',
  fontWeight: 700,
  color: 'var(--color-text)',
};

const counterStyle: CSSProperties = {
  margin: 0,
  fontSize: '12px',
  color: 'var(--color-muted)',
};

const counterEmphasisStyle: CSSProperties = {
  color: 'var(--color-text)',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
};

const labelStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-muted)',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const inputStyle: CSSProperties = {
  height: '38px',
  padding: '0 12px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontFamily: 'inherit',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
};

const charCounterStyle: CSSProperties = {
  fontSize: '10px',
  color: 'var(--color-muted)',
  marginTop: '2px',
  display: 'block',
};

const primaryButtonStyle: CSSProperties = {
  flex: 1,
  height: '38px',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-brand)',
  color: '#fff',
  border: 'none',
  fontFamily: 'inherit',
  fontSize: '13px',
  fontWeight: 600,
};

const neutralButtonStyle: CSSProperties = {
  height: '38px',
  padding: '0 16px',
  borderRadius: 'var(--radius-s)',
  background: 'none',
  border: '1px solid var(--color-border)',
  color: 'var(--color-muted)',
  fontFamily: 'inherit',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
};

// Faixa de aviso do caso D — usa --color-red-l/red (lista permitida do brief).
// Semanticamente é "ação bloqueada", então vermelho coerente; brief mencionou
// "amarela/atenção" como descrição de função, mas amber não está na lista.
const infoBoxStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '8px',
  padding: '10px 14px',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-red-l)',
  border: '1px solid var(--color-red)',
};

const infoIconStyle: CSSProperties = {
  color: 'var(--color-red)',
  flexShrink: 0,
  marginTop: '1px',
};

const infoTextStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-red)',
  lineHeight: 1.4,
};

const errorBoxStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '8px',
  padding: '10px 14px',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-red-l)',
  border: '1px solid var(--color-red)',
};

const errorIconStyle: CSSProperties = {
  color: 'var(--color-red)',
  flexShrink: 0,
  marginTop: '1px',
};

const errorListStyle: CSSProperties = {
  listStyle: 'none',
  fontSize: '12px',
  color: 'var(--color-red)',
  margin: 0,
  padding: 0,
};
