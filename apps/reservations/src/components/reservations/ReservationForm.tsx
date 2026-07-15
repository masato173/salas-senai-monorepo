import React, { useState, useCallback, useMemo } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { validateTimeInput } from '../../validators/conflict';
import { validateReservation } from '../../validators/reservation';
import { ConflictAlert } from '../ui/ConflictAlert';
import { useReservationStore } from '../../store/reservationStore';
import { useCreateReservation } from '../../hooks/useCreateReservation';
import { useCreateReservationRange } from '../../hooks/useCreateReservationRange';
import { useUpdateReservation } from '../../hooks/useUpdateReservation';
import { useUpdateReservationGroup } from '../../hooks/useUpdateReservationGroup';
import { expandDateRange } from '../../utils/dateRange';
import { buildUpdatePayload } from './buildUpdatePayload';
import type {
  CreateReservationRequest,
  CreateReservationResponse,
  CreateReservationRangeRequest,
  CreateReservationRangeResponse,
  UpdateReservationRequest,
  UpdateReservationResponse,
  UpdateReservationGroupRequest,
  UpdateReservationGroupResponse,
  CreatedReservationRow,
} from '../../services/appsScript';
import type {
  CreateReservationInput,
  Turno,
  Reservation,
  RegistroLegado,
  RoomStatus,
} from '../../types';
import { getStatusParaHorario } from '../../services/availability';

export interface ReservationFormService {
  createReservation: (req: CreateReservationRequest) => Promise<CreateReservationResponse>;
  createReservationRange: (
    req: CreateReservationRangeRequest,
  ) => Promise<CreateReservationRangeResponse>;
  updateReservation: (req: UpdateReservationRequest) => Promise<UpdateReservationResponse>;
  updateReservationGroup: (
    req: UpdateReservationGroupRequest,
  ) => Promise<UpdateReservationGroupResponse>;
}

// Sprint 4 D2 — valores iniciais pro modo edit. D3 (modal) preenche.
export interface ReservationFormInitialValues {
  id?: string; // obrigatorio se mode==='edit-single'
  groupId?: string; // obrigatorio se mode==='edit-group'
  data?: string; // YYYY-MM-DD (usado em edit-single)
  inicio: string; // HH:MM
  fim: string; // HH:MM
  observacao: string;
  groupDates?: string[]; // obrigatorio se mode==='edit-group' — display read-only + validacao de horario
}

export type ReservationFormMode = 'create' | 'edit-single' | 'edit-group';

interface ReservationFormProps {
  roomId: string;
  salaName: string; // nome real da sala que o backend espera ("603 Sala")
  userId: string;
  userEmail: string;
  professor: string;
  turma: string;
  service: ReservationFormService;
  onSuccess?: (reservation?: Reservation) => void;
  onCancel?: () => void;
  // Sprint 4 D2 — modo edit. Default 'create' preserva chamadas existentes.
  mode?: ReservationFormMode;
  initialValues?: ReservationFormInitialValues;
  // Sprint Disponibilidade S7 — dados para status inline por data no preview
  // de período. Ausentes = fallback silencioso (RangePreview sem badges).
  registros?: RegistroLegado[];
  reservas?: CreatedReservationRow[];
}

// Turno inferido automaticamente a partir do horário de início
function inferTurno(start: string): Turno {
  const h = parseInt(start.split(':')[0], 10);
  if (h < 13) return 'M';
  if (h < 18) return 'V';
  return 'N';
}

export function ReservationForm({
  roomId,
  salaName,
  userId,
  userEmail,
  professor,
  turma,
  service,
  onSuccess,
  onCancel,
  mode = 'create',
  initialValues,
  registros,
  reservas,
}: ReservationFormProps) {
  const { addReservation, removeReservation, reservations } = useReservationStore();
  const mutation = useCreateReservation(useMemo(() => service, [service]));
  const rangeMutation = useCreateReservationRange(useMemo(() => service, [service]));
  const updateMutation = useUpdateReservation(useMemo(() => service, [service]));
  const updateGroupMutation = useUpdateReservationGroup(useMemo(() => service, [service]));

  const isEditing = mode === 'edit-single' || mode === 'edit-group';
  const isEditGroup = mode === 'edit-group';

  // Estado interno renomeado de 'mode' → 'period' na Fase D2 pra nao colidir
  // com a prop publica 'mode'. No edit, `period` eh forcado 'single' via computacao
  // (hardening D2): mesmo que algum caller futuro chame setPeriodState('range') em
  // modo edit, o valor exposto pelo `period` continua 'single'. Garantia explicita
  // em vez de "ModeToggle escondido protege".
  const [periodState, setPeriodState] = useState<'single' | 'range'>('single');
  const period = isEditing ? 'single' : periodState;

  const [form, setForm] = useState({
    date: initialValues?.data ?? '',
    start: initialValues?.inicio ?? '',
    end: initialValues?.fim ?? '',
    reason: initialValues?.observacao ?? '',
  });

  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([]); // 0=dom..6=sab — mesma convenção do backend
  const [errors, setErrors] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<Reservation[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);

  // Preview ao vivo do período — paridade com o backend via dateRange.ts.
  const expandedDates = useMemo(() => {
    if (!dateStart || !dateEnd || weekdays.length === 0) return [];
    return expandDateRange(dateStart, dateEnd, weekdays);
  }, [dateStart, dateEnd, weekdays]);

  // Sprint Disponibilidade S7 — status por data no preview de período.
  // Só calculado se registros/reservas foram passados E horário está preenchido.
  // Fallback: undefined → RangePreview mantém comportamento original.
  const dateStatuses = useMemo<Record<string, RoomStatus> | undefined>(() => {
    if (!registros || !reservas) return undefined;
    if (!form.start || !form.end || expandedDates.length === 0) return undefined;
    const map: Record<string, RoomStatus> = {};
    for (const data of expandedDates) {
      map[data] = getStatusParaHorario(registros, reservas, salaName, data, form.start, form.end);
    }
    return map;
  }, [registros, reservas, expandedDates, salaName, form.start, form.end]);

  const anyLoading =
    mutation.status === 'loading' ||
    rangeMutation.status === 'loading' ||
    updateMutation.status === 'loading' ||
    updateGroupMutation.status === 'loading';

  const rangeCount = expandedDates.length;
  const rangeCountValid = rangeCount >= 1 && rangeCount <= 60;
  const submitLabel = anyLoading
    ? 'Enviando…'
    : isEditing
      ? 'Salvar alterações'
      : period === 'range'
        ? rangeCountValid
          ? `Solicitar ${rangeCount} reserva${rangeCount === 1 ? '' : 's'}`
          : 'Solicitar reservas'
        : 'Solicitar reserva';

  // Validação inline em tempo real — só mostra erro depois de sair do campo (blur)
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const inlineError = useCallback(
    (field: 'start' | 'end') => {
      if (!touched[field] || !form.start || !form.end || !form.date) return null;
      const r = validateTimeInput({ start: form.start, end: form.end, date: form.date });
      return r.ok ? null : (r.error ?? null);
    },
    [touched, form],
  );

  // ─────────────────────────────────────────────────────────────
  // handleSubmitCreate — Sprint 4 D2: ramo CREATE movido LITERAL do submit
  // anterior. Única alteração textual: estado interno `mode` foi renomeado
  // pra `period` (validado por grep). Lógica e comportamento idênticos.
  // ─────────────────────────────────────────────────────────────
  const handleSubmitCreate = useCallback(async () => {
    if (period === 'range') {
      // ── caminho NOVO: reserva em período (sem optimistic update) ──
      if (!dateStart || !dateEnd) {
        setErrors(['Preencha as datas de início e fim do período.']);
        return;
      }
      if (dateEnd < dateStart) {
        setErrors(['A data de fim deve ser igual ou posterior à data de início.']);
        return;
      }
      if (weekdays.length === 0) {
        setErrors(['Selecione ao menos um dia da semana.']);
        return;
      }
      if (!form.start || !form.end) {
        setErrors(['Preencha o horário de início e fim.']);
        return;
      }
      const referenceDate = expandedDates[0] ?? dateStart;
      const timeResult = validateTimeInput({
        start: form.start,
        end: form.end,
        date: referenceDate,
      });
      if (!timeResult.ok) {
        setErrors([timeResult.error!]);
        return;
      }
      if (expandedDates.length === 0) {
        setErrors(['Nenhuma data válida no período selecionado.']);
        return;
      }
      if (expandedDates.length > 60) {
        setErrors(['Excede o limite de 60 reservas. Reduza o período ou os dias selecionados.']);
        return;
      }

      try {
        const res = await rangeMutation.mutate({
          userEmail,
          payload: {
            sala: salaName,
            dataInicio: dateStart,
            dataFim: dateEnd,
            diasSemana: weekdays,
            inicio: form.start,
            fim: form.end,
            professor,
            turma,
            observacao: form.reason,
          },
        });

        if (res.ok) {
          setSubmittedCount(res.data?.count ?? expandedDates.length);
          setSubmitted(true);
          onSuccess?.();
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
        if (res.error) {
          setErrors([res.error.message || 'Falha ao criar reservas.']);
          return;
        }
        // Defensivo: envelope ok=false sem error definido (não deve acontecer com o backend atual).
        setErrors(['Falha desconhecida ao criar reservas.']);
      } catch {
        setErrors(['Falha de conexão. Tente novamente.']);
      }
      return;
    }

    // 1. Validação local de horário — primeira barreira
    const timeResult = validateTimeInput({ start: form.start, end: form.end, date: form.date });
    if (!timeResult.ok) {
      setErrors([timeResult.error!]);
      return;
    }

    const turno = inferTurno(form.start);

    const input: CreateReservationInput = {
      roomId,
      userId,
      date: form.date,
      start: form.start,
      end: form.end,
      turno,
      reason: form.reason,
    };

    // 2. Validação do DTO local
    const dtoResult = validateReservation(input);
    if (!dtoResult.ok) {
      setErrors(dtoResult.errors);
      return;
    }

    // 2.5 — Verificação de conflito com aulas (registros do schedule).
    // detectConflicts do store só compara reservas locais — não cobre aulas.
    // getStatusParaHorario cruza registros + reservas pelo horário exato.
    if (registros && registros.length > 0) {
      const statusLocal = getStatusParaHorario(
        registros,
        reservas ?? [],
        salaName,
        form.date,
        form.start,
        form.end,
      );
      if (statusLocal === 'aula') {
        setErrors(['Esta sala já possui aula neste horário. Escolha outro horário ou sala.']);
        return;
      }
      if (statusLocal === 'reserva') {
        setErrors(['Esta sala já possui reserva neste horário. Escolha outro horário ou sala.']);
        return;
      }
      if (statusLocal === 'conflito') {
        setErrors([
          'Esta sala possui aula e reserva neste horário. Escolha outro horário ou sala.',
        ]);
        return;
      }
    }

    // 3. Optimistic update no store (conflito local detectado aqui também)
    const optimistic = addReservation(input);
    if (!optimistic.ok || !optimistic.reservation) {
      const list = optimistic.errors ?? [];
      const conflictError = list.find(e => e.startsWith('Conflito'));
      if (conflictError) {
        const ids: string[] = conflictError.match(/res-\d+/g) ?? [];
        setConflicts(reservations.filter(r => ids.includes(r.id)));
      }
      setErrors(list.filter(e => !e.startsWith('Conflito')));
      return;
    }
    const tempId = optimistic.reservation.id;

    // 4. Envia para o backend (autoridade final — conflitos reais vêm daqui)
    const res = await mutation.mutate({
      userEmail,
      payload: {
        sala: salaName,
        data: form.date,
        inicio: form.start,
        fim: form.end,
        professor,
        turma,
        observacao: form.reason,
      },
    });

    if (res.ok) {
      setSubmitted(true);
      onSuccess?.(optimistic.reservation);
      return;
    }

    // 5. Rollback: backend rejeitou — remove a reserva otimista
    removeReservation(tempId);

    if (res.error?.code === 'CONFLICT') {
      setErrors([res.error.message || 'Conflito detectado no servidor.']);
    } else if (res.error) {
      setErrors([res.error.message || 'Falha ao criar reserva.']);
    } else {
      setErrors(['Falha desconhecida ao criar reserva.']);
    }
  }, [
    period,
    form,
    roomId,
    userId,
    userEmail,
    salaName,
    professor,
    turma,
    dateStart,
    dateEnd,
    weekdays,
    expandedDates,
    addReservation,
    removeReservation,
    mutation,
    rangeMutation,
    reservations,
    onSuccess,
    registros,
    reservas,
  ]);

  // ─────────────────────────────────────────────────────────────
  // handleSubmitEditSingle — Sprint 4 D2 (C1).
  // Payload PUT-like com data. Guard de id ausente via buildUpdatePayload.
  // Sem optimistic, sem tela de sucesso ✓ — chama onSuccess direto.
  // ─────────────────────────────────────────────────────────────
  const handleSubmitEditSingle = useCallback(async () => {
    const timeResult = validateTimeInput({ start: form.start, end: form.end, date: form.date });
    if (!timeResult.ok) {
      setErrors([timeResult.error!]);
      return;
    }

    const built = buildUpdatePayload({
      mode: 'edit-single',
      form,
      initialValues: initialValues ?? {},
      salaName,
      turma,
    });
    if (!built.ok) {
      setErrors([built.error]);
      return;
    }
    if (built.mode !== 'edit-single') {
      // Defesa estática: builder garante a discriminante, mas o narrow ajuda o TS.
      setErrors(['Erro interno ao montar payload de edição.']);
      return;
    }

    try {
      const res = await updateMutation.mutate({
        userEmail,
        payload: built.payload,
      });

      if (res.ok) {
        onSuccess?.();
        return;
      }

      // Backend devolve mensagens claras pra CONFLICT, FORBIDDEN, NOT_FOUND, VALIDATION.
      setErrors([res.error?.message ?? 'Falha desconhecida ao salvar alterações.']);
    } catch {
      setErrors(['Falha de conexão. Tente novamente.']);
    }
  }, [form, initialValues, salaName, turma, userEmail, updateMutation, onSuccess]);

  // ─────────────────────────────────────────────────────────────
  // handleSubmitEditGroup — Sprint 4 D2 (C2). Payload SEM data.
  // Guards: groupId via buildUpdatePayload; groupDates inline (necessario
  // pra validar horario via primeira data do grupo).
  // ─────────────────────────────────────────────────────────────
  const handleSubmitEditGroup = useCallback(async () => {
    if (!initialValues?.groupDates || initialValues.groupDates.length === 0) {
      setErrors(['Inconsistência interna: datas do grupo ausentes.']);
      return;
    }

    // Valida horario usando primeira data do grupo (validateTimeInput exige `date`).
    const referenceDate = initialValues.groupDates[0];
    const timeResult = validateTimeInput({ start: form.start, end: form.end, date: referenceDate });
    if (!timeResult.ok) {
      setErrors([timeResult.error!]);
      return;
    }

    const built = buildUpdatePayload({
      mode: 'edit-group',
      form,
      initialValues,
      salaName,
      turma,
    });
    if (!built.ok) {
      setErrors([built.error]);
      return;
    }
    if (built.mode !== 'edit-group') {
      setErrors(['Erro interno ao montar payload de edição.']);
      return;
    }

    try {
      const res = await updateGroupMutation.mutate({
        userEmail,
        payload: built.payload,
      });

      if (res.ok) {
        onSuccess?.();
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

      setErrors([res.error?.message ?? 'Falha desconhecida ao salvar alterações no grupo.']);
    } catch {
      setErrors(['Falha de conexão. Tente novamente.']);
    }
  }, [form, initialValues, salaName, turma, userEmail, updateGroupMutation, onSuccess]);

  // Despachante.
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrors([]);
      setConflicts([]);

      if (mode === 'edit-single') return handleSubmitEditSingle();
      if (mode === 'edit-group') return handleSubmitEditGroup();
      return handleSubmitCreate();
    },
    [mode, handleSubmitCreate, handleSubmitEditSingle, handleSubmitEditGroup],
  );

  if (submitted) {
    return (
      <div
        style={{
          borderRadius: 'var(--radius)',
          border: '1px solid var(--color-green)',
          background: 'var(--color-green-l)',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontWeight: 600, color: 'var(--color-green)', fontSize: '14px' }}>
          ✓{' '}
          {submittedCount !== null && submittedCount !== 1
            ? `${submittedCount} reservas criadas com sucesso!`
            : 'Reserva enviada com sucesso!'}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '4px' }}>
          Aguardando aprovação do coordenador.
        </p>
      </div>
    );
  }

  const timeError = inlineError('start') ?? inlineError('end');

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      {!isEditing && (
        <ModeToggle
          period={period}
          onChange={m => {
            setPeriodState(m);
            setErrors([]);
            setConflicts([]);
          }}
          disabled={anyLoading}
        />
      )}

      {!isEditing && <ConflictAlert conflicts={conflicts} onDismiss={() => setConflicts([])} />}

      {errors.length > 0 && (
        <div
          role="alert"
          style={{
            borderRadius: 'var(--radius-s)',
            border: '1px solid var(--color-red)',
            background: 'var(--color-red-l)',
            padding: '10px 14px',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
          }}
        >
          <AlertCircle
            size={14}
            style={{ color: 'var(--color-red)', flexShrink: 0, marginTop: '1px' }}
          />
          <ul style={{ listStyle: 'none', fontSize: '12px', color: 'var(--color-red)' }}>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Datas do grupo — read-only no edit-group (informativo) */}
      {isEditGroup && (
        <Field label="Datas do grupo (não editável)" htmlFor="res-group-dates">
          <div
            id="res-group-dates"
            style={{
              fontSize: 12,
              padding: '8px 12px',
              borderRadius: 'var(--radius-s)',
              background: 'var(--color-bg)',
              border: '1px dashed var(--color-border)',
              color: 'var(--color-muted)',
            }}
          >
            {initialValues?.groupDates && initialValues.groupDates.length > 0
              ? initialValues.groupDates.slice(0, 10).map(isoToBR).join(', ') +
                (initialValues.groupDates.length > 10
                  ? ` (+${initialValues.groupDates.length - 10} mais)`
                  : '')
              : '—'}
          </div>
        </Field>
      )}

      {/* Data — modo único (create OU edit-single) */}
      {!isEditGroup && period === 'single' && (
        <Field label="Data *" htmlFor="res-date">
          <input
            id="res-date"
            type="date"
            required
            value={form.date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            onBlur={() => setTouched(t => ({ ...t, date: true }))}
            style={inputStyle}
          />
        </Field>
      )}

      {/* Período — só no create */}
      {mode === 'create' && period === 'range' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Data início *" htmlFor="res-date-start">
              <input
                id="res-date-start"
                type="date"
                required
                value={dateStart}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setDateStart(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Data fim *" htmlFor="res-date-end">
              <input
                id="res-date-end"
                type="date"
                required
                value={dateEnd}
                min={dateStart || new Date().toISOString().slice(0, 10)}
                onChange={e => setDateEnd(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          <WeekdayPicker value={weekdays} onChange={setWeekdays} />
          <RangePreview
            dates={expandedDates}
            maxAllowed={60}
            inputsReady={!!(dateStart && dateEnd && weekdays.length > 0)}
            {...(dateStatuses !== undefined && { dateStatuses })}
          />
        </>
      )}

      {/* Horários — lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="Início *" htmlFor="res-start" hint="HH:MM">
          <div style={{ position: 'relative' }}>
            <Clock
              size={13}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              id="res-start"
              type="time"
              required
              value={form.start}
              onChange={e => setForm(f => ({ ...f, start: e.target.value }))}
              onBlur={() => setTouched(t => ({ ...t, start: true }))}
              style={{ ...inputStyle, paddingLeft: '30px' }}
            />
          </div>
        </Field>

        <Field label="Fim *" htmlFor="res-end" hint="HH:MM">
          <div style={{ position: 'relative' }}>
            <Clock
              size={13}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              id="res-end"
              type="time"
              required
              value={form.end}
              onChange={e => setForm(f => ({ ...f, end: e.target.value }))}
              onBlur={() => setTouched(t => ({ ...t, end: true }))}
              style={{ ...inputStyle, paddingLeft: '30px' }}
            />
          </div>
        </Field>
      </div>

      {/* Erro de horário inline */}
      {timeError && (
        <p style={{ fontSize: '11px', color: 'var(--color-red)', marginTop: '-8px' }}>
          {timeError}
        </p>
      )}

      {/* Preview do turno inferido */}
      {form.start && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--color-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '-8px',
          }}
        >
          <span>Turno detectado:</span>
          <TurnoPreview turno={inferTurno(form.start)} />
        </div>
      )}

      {/* Duração calculada */}
      {form.start && form.end && <DurationPreview start={form.start} end={form.end} />}

      {/* Motivo */}
      <Field label="Motivo" htmlFor="res-reason">
        <input
          id="res-reason"
          type="text"
          maxLength={200}
          value={form.reason}
          onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
          placeholder="Ex: Aula de ADM, Laboratório CLP..."
          style={inputStyle}
        />
        <span
          style={{
            fontSize: '10px',
            color: 'var(--color-subtle)',
            marginTop: '2px',
            display: 'block',
          }}
        >
          {form.reason.length}/200
        </span>
      </Field>

      {/* Botões */}
      <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
        <button
          type="submit"
          disabled={anyLoading}
          style={{
            flex: 1,
            height: '38px',
            borderRadius: 'var(--radius-s)',
            background: 'var(--color-brand)',
            color: '#fff',
            border: 'none',
            fontFamily: 'inherit',
            fontSize: '13px',
            fontWeight: 600,
            cursor: anyLoading ? 'wait' : 'pointer',
            opacity: anyLoading ? 0.7 : 1,
          }}
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={anyLoading}
            style={{
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
            }}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

// ── Helpers visuais ───────────────────────────────────────────

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']; // 0..6 — mesma convenção do backend

function WeekdayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  function toggle(day: number) {
    if (value.includes(day)) onChange(value.filter(d => d !== day));
    else onChange([...value, day].sort((a, b) => a - b));
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '.05em',
        }}
      >
        Dias da semana *
      </label>
      <div
        role="group"
        aria-label="Dias da semana"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6,
        }}
      >
        {WEEKDAY_LABELS.map((label, day) => {
          const on = value.includes(day);
          return (
            <button
              key={day}
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-label={label}
              onClick={() => toggle(day)}
              style={{
                height: 34,
                border: '1px solid var(--color-border)',
                background: on ? 'var(--color-brand)' : 'var(--color-surface)',
                color: on ? '#fff' : 'var(--color-text)',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 'var(--radius-s)',
                cursor: 'pointer',
                transition: 'background .12s, color .12s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_BADGE: Record<RoomStatus, { label: string; color: string; bg: string }> = {
  livre: { label: 'livre', color: 'var(--color-green)', bg: 'var(--color-green-l)' },
  aula: { label: 'aula', color: 'var(--color-amber)', bg: 'var(--color-amber-l)' },
  reserva: { label: 'reserva', color: 'var(--color-blue)', bg: 'var(--color-blue-l)' },
  conflito: { label: 'conflito', color: 'var(--color-red)', bg: 'var(--color-red-l)' },
};

function RangePreview({
  dates,
  maxAllowed,
  inputsReady,
  dateStatuses,
}: {
  dates: string[];
  maxAllowed: number;
  inputsReady: boolean;
  dateStatuses?: Record<string, RoomStatus>;
}) {
  if (dates.length === 0) {
    return (
      <div
        style={{
          fontSize: 11,
          padding: '6px 10px',
          borderRadius: 'var(--radius-s)',
          background: 'var(--color-bg)',
          color: 'var(--color-muted)',
          border: '1px dashed var(--color-border)',
        }}
      >
        {inputsReady
          ? 'Nenhuma data no período bate com os dias selecionados.'
          : 'Preencha o período e selecione ao menos um dia da semana.'}
      </div>
    );
  }
  const exceeded = dates.length > maxAllowed;
  const moreCount = dates.length - 10;
  const shownDates = dates.slice(0, 10);
  return (
    <div
      style={{
        fontSize: 11,
        padding: '8px 12px',
        borderRadius: 'var(--radius-s)',
        background: exceeded ? 'var(--color-red-l)' : 'var(--color-green-l)',
        color: exceeded ? 'var(--color-red)' : 'var(--color-green)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <strong style={{ fontSize: 12 }}>
        {exceeded
          ? `Excede o limite de ${maxAllowed} reservas. Reduza o período ou os dias selecionados.`
          : `${dates.length} ${dates.length === 1 ? 'reserva será criada' : 'reservas serão criadas'}.`}
      </strong>
      {dateStatuses ? (
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {shownDates.map(d => {
            const s = STATUS_BADGE[dateStatuses[d] ?? 'livre'];
            return (
              <span
                key={d}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: s.bg,
                  color: s.color,
                  fontWeight: 600,
                }}
              >
                {isoToBR(d)}
                <span style={{ fontWeight: 500, opacity: 0.85 }}>· {s.label}</span>
              </span>
            );
          })}
          {moreCount > 0 && <span style={{ opacity: 0.85 }}>+{moreCount} mais</span>}
        </span>
      ) : (
        <span>
          {shownDates.map(isoToBR).join(', ')}
          {moreCount > 0 ? `, +${moreCount} mais` : ''}
        </span>
      )}
    </div>
  );
}

function isoToBR(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function ModeToggle({
  period,
  onChange,
  disabled,
}: {
  period: 'single' | 'range';
  onChange: (m: 'single' | 'range') => void;
  disabled: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Tipo de reserva"
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-s)',
      }}
    >
      {(['single', 'range'] as const).map(opt => {
        const active = period === opt;
        return (
          <button
            key={opt}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(opt)}
            style={{
              flex: 1,
              height: 30,
              border: 'none',
              background: active ? 'var(--color-surface)' : 'transparent',
              color: active ? 'var(--color-text)' : 'var(--color-muted)',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              boxShadow: active ? 'var(--shadow-s)' : 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'background .12s, color .12s',
            }}
          >
            {opt === 'single' ? 'Única' : 'Período'}
          </button>
        );
      })}
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}

function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '.05em',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        {label}
        {hint && (
          <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({hint})</span>
        )}
      </label>
      {children}
    </div>
  );
}

const TURNO_STYLE: Record<Turno, { bg: string; color: string; label: string }> = {
  M: { bg: 'var(--color-amber-l)', color: 'var(--color-amber)', label: '☀ Matutino' },
  V: { bg: 'var(--color-green-l)', color: 'var(--color-green)', label: '🌤 Vespertino' },
  N: { bg: '#ede9fe', color: '#4c1d95', label: '🌙 Noturno' },
};

function TurnoPreview({ turno }: { turno: Turno }) {
  const s = TURNO_STYLE[turno];
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: '20px',
        background: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}

function DurationPreview({ start, end }: { start: string; end: string }) {
  const startMin = parseInt(start.split(':')[0]) * 60 + parseInt(start.split(':')[1]);
  const endMin = parseInt(end.split(':')[0]) * 60 + parseInt(end.split(':')[1]);
  const dur = endMin - startMin;
  if (dur <= 0) return null;

  const h = Math.floor(dur / 60);
  const m = dur % 60;
  const label = h > 0 && m > 0 ? `${h}h ${m}min` : h > 0 ? `${h}h` : `${m}min`;
  const ok = dur >= 30 && dur <= 240;

  return (
    <div
      style={{
        fontSize: '11px',
        padding: '6px 10px',
        borderRadius: 'var(--radius-s)',
        background: ok ? 'var(--color-green-l)' : 'var(--color-red-l)',
        color: ok ? 'var(--color-green)' : 'var(--color-red)',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        marginTop: '-8px',
      }}
    >
      <Clock size={11} />
      Duração: <strong>{label}</strong>
      {!ok && dur > 240 && ' — máximo 4 horas'}
      {!ok && dur < 30 && ' — mínimo 30 minutos'}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
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
