import React, { useState, useCallback, useMemo } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { validateTimeInput } from '../../validators/conflict';
import { validateReservation } from '../../validators/reservation';
import { ConflictAlert } from '../ui/ConflictAlert';
import { useReservationStore } from '../../store/reservationStore';
import { useCreateReservation } from '../../hooks/useCreateReservation';
import { useCreateReservationRange } from '../../hooks/useCreateReservationRange';
import { expandDateRange } from '../../utils/dateRange';
import type {
  CreateReservationRequest,
  CreateReservationResponse,
  CreateReservationRangeRequest,
  CreateReservationRangeResponse,
} from '../../services/appsScript';
import type { CreateReservationInput, Turno, Reservation } from '../../types';

interface ReservationCreator {
  createReservation:      (req: CreateReservationRequest)      => Promise<CreateReservationResponse>;
  createReservationRange: (req: CreateReservationRangeRequest) => Promise<CreateReservationRangeResponse>;
}

interface ReservationFormProps {
  roomId:     string;
  salaName:   string; // nome real da sala que o backend espera ("603 Sala")
  userId:     string;
  userEmail:  string;
  professor:  string;
  turma:      string;
  service:    ReservationCreator;
  onSuccess?: (reservation?: Reservation) => void;
  onCancel?:  () => void;
}

// Turno inferido automaticamente a partir do horário de início
function inferTurno(start: string): Turno {
  const h = parseInt(start.split(':')[0], 10);
  if (h < 13) return 'M';
  if (h < 18) return 'V';
  return 'N';
}

export function ReservationForm({
  roomId, salaName, userId, userEmail, professor, turma,
  service, onSuccess, onCancel,
}: ReservationFormProps) {
  const { addReservation, removeReservation, reservations } = useReservationStore();
  const mutation      = useCreateReservation(useMemo(() => service, [service]));
  const rangeMutation = useCreateReservationRange(useMemo(() => service, [service]));

  const [mode, setMode] = useState<'single' | 'range'>('single');
  const [form, setForm] = useState({ date: '', start: '', end: '', reason: '' });
  const [dateStart, setDateStart] = useState('');
  const [dateEnd,   setDateEnd]   = useState('');
  const [weekdays,  setWeekdays]  = useState<number[]>([]); // 0=dom..6=sab — mesma convenção do backend
  const [errors,    setErrors]    = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<Reservation[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);

  // Preview ao vivo do período — paridade com o backend via dateRange.ts.
  const expandedDates = useMemo(() => {
    if (!dateStart || !dateEnd || weekdays.length === 0) return [];
    return expandDateRange(dateStart, dateEnd, weekdays);
  }, [dateStart, dateEnd, weekdays]);

  const anyLoading = mutation.status === 'loading' || rangeMutation.status === 'loading';

  const rangeCount      = expandedDates.length;
  const rangeCountValid = rangeCount >= 1 && rangeCount <= 60;
  const submitLabel = anyLoading
    ? 'Enviando…'
    : mode === 'range'
      ? (rangeCountValid ? `Solicitar ${rangeCount} reserva${rangeCount === 1 ? '' : 's'}` : 'Solicitar reservas')
      : 'Solicitar reserva';

  // Validação inline em tempo real — só mostra erro depois de sair do campo (blur)
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const inlineError = useCallback((field: 'start' | 'end') => {
    if (!touched[field] || !form.start || !form.end || !form.date) return null;
    const r = validateTimeInput({ start: form.start, end: form.end, date: form.date });
    return r.ok ? null : r.error ?? null;
  }, [touched, form]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setConflicts([]);

    if (mode === 'range') {
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
      const timeResult = validateTimeInput({ start: form.start, end: form.end, date: referenceDate });
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
            sala:       salaName,
            dataInicio: dateStart,
            dataFim:    dateEnd,
            diasSemana: weekdays,
            inicio:     form.start,
            fim:        form.end,
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
      roomId, userId,
      date:   form.date,
      start:  form.start,
      end:    form.end,
      turno,
      reason: form.reason,
    };

    // 2. Validação do DTO local
    const dtoResult = validateReservation(input);
    if (!dtoResult.ok) {
      setErrors(dtoResult.errors);
      return;
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
        sala:       salaName,
        data:       form.date,
        inicio:     form.start,
        fim:        form.end,
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
    mode, form, roomId, userId, userEmail, salaName, professor, turma,
    dateStart, dateEnd, weekdays, expandedDates,
    addReservation, removeReservation, mutation, rangeMutation, reservations, onSuccess,
  ]);

  if (submitted) {
    return (
      <div style={{
        borderRadius: 'var(--radius)', border: '1px solid var(--color-green)',
        background: 'var(--color-green-l)', padding: '24px', textAlign: 'center',
      }}>
        <p style={{ fontWeight: 600, color: 'var(--color-green)', fontSize: '14px' }}>
          ✓ {submittedCount !== null && submittedCount !== 1
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
    <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      <ModeToggle
        mode={mode}
        onChange={(m) => { setMode(m); setErrors([]); setConflicts([]); }}
        disabled={anyLoading}
      />

      <ConflictAlert conflicts={conflicts} onDismiss={() => setConflicts([])} />

      {errors.length > 0 && (
        <div role="alert" style={{
          borderRadius: 'var(--radius-s)', border: '1px solid var(--color-red)',
          background: 'var(--color-red-l)', padding: '10px 14px',
          display: 'flex', gap: '8px', alignItems: 'flex-start',
        }}>
          <AlertCircle size={14} style={{ color: 'var(--color-red)', flexShrink: 0, marginTop: '1px' }} />
          <ul style={{ listStyle: 'none', fontSize: '12px', color: 'var(--color-red)' }}>
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Data — modo único OU período */}
      {mode === 'single' && (
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

      {mode === 'range' && (
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
          />
        </>
      )}

      {/* Horários — lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="Início *" htmlFor="res-start" hint="HH:MM">
          <div style={{ position: 'relative' }}>
            <Clock size={13} style={{
              position: 'absolute', left: '10px', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--color-muted)',
              pointerEvents: 'none',
            }} />
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
            <Clock size={13} style={{
              position: 'absolute', left: '10px', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--color-muted)',
              pointerEvents: 'none',
            }} />
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
        <div style={{
          fontSize: '11px', color: 'var(--color-muted)',
          display: 'flex', alignItems: 'center', gap: '6px',
          marginTop: '-8px',
        }}>
          <span>Turno detectado:</span>
          <TurnoPreview turno={inferTurno(form.start)} />
        </div>
      )}

      {/* Duração calculada */}
      {form.start && form.end && (
        <DurationPreview start={form.start} end={form.end} />
      )}

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
        <span style={{ fontSize: '10px', color: 'var(--color-subtle)', marginTop: '2px', display: 'block' }}>
          {form.reason.length}/200
        </span>
      </Field>

      {/* Botões */}
      <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
        <button
          type="submit"
          disabled={anyLoading}
          style={{
            flex: 1, height: '38px', borderRadius: 'var(--radius-s)',
            background: 'var(--color-brand)', color: '#fff', border: 'none',
            fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
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
              height: '38px', padding: '0 16px', borderRadius: 'var(--radius-s)',
              background: 'none', border: '1px solid var(--color-border)',
              color: 'var(--color-muted)', fontFamily: 'inherit',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer',
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
  value, onChange,
}: {
  value:    number[];
  onChange: (next: number[]) => void;
}) {
  function toggle(day: number) {
    if (value.includes(day)) onChange(value.filter(d => d !== day));
    else                     onChange([...value, day].sort((a, b) => a - b));
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{
        fontSize: '11px', fontWeight: 600,
        color: 'var(--color-muted)',
        textTransform: 'uppercase', letterSpacing: '.05em',
      }}>
        Dias da semana *
      </label>
      <div role="group" aria-label="Dias da semana" style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6,
      }}>
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
                color:      on ? '#fff'              : 'var(--color-text)',
                fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
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

function RangePreview({
  dates, maxAllowed, inputsReady,
}: {
  dates:       string[];
  maxAllowed:  number;
  inputsReady: boolean;
}) {
  if (dates.length === 0) {
    return (
      <div style={{
        fontSize: 11, padding: '6px 10px', borderRadius: 'var(--radius-s)',
        background: 'var(--color-bg)', color: 'var(--color-muted)',
        border: '1px dashed var(--color-border)',
      }}>
        {inputsReady
          ? 'Nenhuma data no período bate com os dias selecionados.'
          : 'Preencha o período e selecione ao menos um dia da semana.'}
      </div>
    );
  }
  const exceeded  = dates.length > maxAllowed;
  const shown     = dates.slice(0, 10).map(isoToBR).join(', ');
  const moreCount = dates.length - 10;
  return (
    <div style={{
      fontSize: 11, padding: '8px 12px', borderRadius: 'var(--radius-s)',
      background: exceeded ? 'var(--color-red-l)' : 'var(--color-green-l)',
      color:      exceeded ? 'var(--color-red)'   : 'var(--color-green)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <strong style={{ fontSize: 12 }}>
        {exceeded
          ? `Excede o limite de ${maxAllowed} reservas. Reduza o período ou os dias selecionados.`
          : `${dates.length} ${dates.length === 1 ? 'reserva será criada' : 'reservas serão criadas'}.`}
      </strong>
      <span>{shown}{moreCount > 0 ? `, +${moreCount} mais` : ''}</span>
    </div>
  );
}

function isoToBR(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function ModeToggle({
  mode, onChange, disabled,
}: {
  mode:     'single' | 'range';
  onChange: (m: 'single' | 'range') => void;
  disabled: boolean;
}) {
  return (
    <div role="tablist" aria-label="Tipo de reserva" style={{
      display: 'flex', gap: 4, padding: 4,
      background: 'var(--color-bg)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-s)',
    }}>
      {(['single', 'range'] as const).map(opt => {
        const active = mode === opt;
        return (
          <button
            key={opt}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(opt)}
            style={{
              flex: 1, height: 30,
              border: 'none',
              background: active ? 'var(--color-surface)' : 'transparent',
              color:      active ? 'var(--color-text)'    : 'var(--color-muted)',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
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
  label:    string;
  htmlFor:  string;
  hint?:    string;
  children: React.ReactNode;
}

function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label htmlFor={htmlFor} style={{
        fontSize: '11px', fontWeight: 600,
        color: 'var(--color-muted)',
        textTransform: 'uppercase', letterSpacing: '.05em',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        {label}
        {hint && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({hint})</span>}
      </label>
      {children}
    </div>
  );
}

const TURNO_STYLE: Record<Turno, { bg: string; color: string; label: string }> = {
  M: { bg: 'var(--color-amber-l)',  color: 'var(--color-amber)',  label: '☀ Matutino'   },
  V: { bg: 'var(--color-green-l)',  color: 'var(--color-green)',  label: '🌤 Vespertino' },
  N: { bg: '#ede9fe',               color: '#4c1d95',             label: '🌙 Noturno'    },
};

function TurnoPreview({ turno }: { turno: Turno }) {
  const s = TURNO_STYLE[turno];
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700,
      padding: '2px 8px', borderRadius: '20px',
      background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

function DurationPreview({ start, end }: { start: string; end: string }) {
  const startMin = parseInt(start.split(':')[0]) * 60 + parseInt(start.split(':')[1]);
  const endMin   = parseInt(end.split(':')[0])   * 60 + parseInt(end.split(':')[1]);
  const dur      = endMin - startMin;
  if (dur <= 0) return null;

  const h = Math.floor(dur / 60);
  const m = dur % 60;
  const label = h > 0 && m > 0 ? `${h}h ${m}min` : h > 0 ? `${h}h` : `${m}min`;
  const ok = dur >= 30 && dur <= 240;

  return (
    <div style={{
      fontSize: '11px', padding: '6px 10px', borderRadius: 'var(--radius-s)',
      background: ok ? 'var(--color-green-l)' : 'var(--color-red-l)',
      color: ok ? 'var(--color-green)' : 'var(--color-red)',
      display: 'flex', alignItems: 'center', gap: '5px',
      marginTop: '-8px',
    }}>
      <Clock size={11} />
      Duração: <strong>{label}</strong>
      {!ok && dur > 240 && ' — máximo 4 horas'}
      {!ok && dur < 30  && ' — mínimo 30 minutos'}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  height: '38px', padding: '0 12px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontFamily: 'inherit', fontSize: '13px',
  outline: 'none', width: '100%',
};
