import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Clock, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { useReservationStore } from '../../store/reservationStore';
import { ReservationList } from '../../components/reservations/ReservationList';
import { ReservationForm } from '../../components/reservations/ReservationForm';
import { ReservationCalendar } from '../../components/reservations/ReservationCalendar';
import { ReservationDetailsModal } from '../../components/reservations/ReservationDetailsModal';
import { createAppsScriptService } from '../../services/appsScript';
import { createNestjsApiService } from '../../services/nestjsApiService';
import { useListReservations } from '../../hooks/useListReservations';
import { useCancelReservation } from '../../hooks/useCancelReservation';
import { useSchedule } from '../../hooks/useSchedule';
import { useAvailability } from '../../hooks/useAvailability';
import { useAvailabilityBackend, BACKEND_DRIVER_ENABLED } from '../../hooks/useAvailabilityBackend';
import { todayYmd } from '../../components/dashboard/scheduleDateUtils';
import {
  reservationToEvent,
  type ReservationDetails,
} from '../../components/reservations/reservationToEvent';
import { getEventosDaSala } from '../../services/availability';
import { RoomAvailabilityPanel } from '../../components/reservations/RoomAvailabilityPanel';
import { APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN, SALAS, CURRENT_USER } from '../../config';
import type { RegistroLegado, SalaEvento } from '../../types';

export default function ReservasPage() {
  const { reservations } = useReservationStore();
  const [showForm, setShowForm] = useState(false);
  const [sala, setSala] = useState<string>(SALAS[6]); // "603 Sala"
  const [turma, setTurma] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(todayYmd);
  const [selectedReservation, setSelectedReservation] = useState<ReservationDetails | null>(null);

  // F5.4-F5.6: quando BACKEND_DRIVER_ENABLED=true, usa NestJS para
  // listReservations, createReservation e cancelReservation.
  // fetchSchedule e operações de grupo ainda delegam ao Apps Script (fallback).
  const service = useMemo(() => {
    const appsScript = createAppsScriptService({ url: APPS_SCRIPT_URL, token: APPS_SCRIPT_TOKEN });
    return BACKEND_DRIVER_ENABLED ? createNestjsApiService(appsScript) : appsScript;
  }, []);

  // Lista de reservas pro calendário (auto-fetch no mount via hook default).
  const list = useListReservations(service);
  const events = useMemo(
    () => (list.data?.reservations ?? []).map(reservationToEvent),
    [list.data],
  );

  // Sprint Disponibilidade S6 — fluxo data → sala → form.
  // Aulas vêm de useSchedule; reservas do list acima. Ambos memoizados.
  const schedule = useSchedule(service);
  const registros = useMemo<RegistroLegado[]>(
    () => schedule.data?.registros ?? [],
    [schedule.data],
  );
  const reservas = useMemo(() => list.data?.reservations ?? [], [list.data]);
  const localDisp = useAvailability(registros, reservas, selectedDate, SALAS);
  // F4.7b: quando VITE_BACKEND_DRIVER=true, usa GET /availability do NestJS.
  // Fallback para legado enquanto carrega ou se flag desligada.
  const backendDispRes = useAvailabilityBackend(selectedDate, undefined, {
    enabled: BACKEND_DRIVER_ENABLED,
  });
  const disp =
    BACKEND_DRIVER_ENABLED && backendDispRes.data !== null ? backendDispRes.data : localDisp;

  // Sprint Disponibilidade S8 — eventos futuros da sala selecionada pro painel.
  // todayYmd() é estável no dia → não entra nas deps do useMemo.
  const eventosParaPanel = useMemo<SalaEvento[]>(
    () => getEventosDaSala(registros, reservas, sala, todayYmd()),
    [registros, reservas, sala],
  );

  // Status da sala na data selecionada. Default 'livre' se não achar.
  function statusDaSala(nomeSala: string): 'livre' | 'aula' | 'reserva' | 'conflito' {
    return disp.salas.find(s => s.sala === nomeSala)?.status ?? 'livre';
  }

  // Se a data mudar e a sala atual ficar ocupada, resetar pra primeira sala
  // livre. Se nenhuma estiver livre, mantém a atual (usuário vê o disabled).
  useEffect(() => {
    if (statusDaSala(sala) !== 'livre') {
      const primeiraLivre = SALAS.find(s => statusDaSala(s) === 'livre');
      if (primeiraLivre) setSala(primeiraLivre);
    }
    // disp muda quando selectedDate muda; não precisa listar todas as deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, disp]);

  // Sprint 4 D3 — datas do grupo da reserva selecionada, derivadas da lista
  // já carregada (sem nova query). Filtra ACTIVE pra espelhar o backend C2.
  // YYYY-MM-DD ordena lexico = cronológico.
  const groupDates = useMemo(() => {
    const gid = selectedReservation?.groupId;
    if (!gid || !list.data?.reservations) return undefined;
    return list.data.reservations
      .filter(r => r.groupId === gid && r.status === 'ACTIVE')
      .map(r => r.data)
      .sort();
  }, [selectedReservation?.groupId, list.data?.reservations]);

  // Sprint 4 D4.4 — mapa data→id do mesmo grupo ACTIVE. Pro caminho C3
  // (edit-selected), o EditSelectedView traduz datas selecionadas em ids[].
  // Mesmo filtro do groupDates pra coerência.
  const groupIdMap = useMemo<Record<string, string> | undefined>(() => {
    const gid = selectedReservation?.groupId;
    if (!gid || !list.data?.reservations) return undefined;
    const map: Record<string, string> = {};
    for (const r of list.data.reservations) {
      if (r.groupId === gid && r.status === 'ACTIVE') {
        map[r.data] = r.id;
      }
    }
    return map;
  }, [selectedReservation?.groupId, list.data?.reservations]);

  // Cancel (4.2b). Estado vive aqui; modal recebe via props.
  const cancelMutation = useCancelReservation(service);
  const handleConfirmCancel = async (id: string) => {
    const res = await cancelMutation.mutate({
      userEmail: CURRENT_USER.userEmail,
      payload: { id },
    });
    if (res.ok) {
      setSelectedReservation(null);
      cancelMutation.reset();
      void list.refetch();
    }
    // Erro: cancelMutation.error/status já preenchidos pelo hook; modal observa via props.
  };

  const pending = reservations.filter(r => r.status === 'PENDING').length;
  const approved = reservations.filter(r => r.status === 'APPROVED').length;
  const rejected = reservations.filter(
    r => r.status === 'REJECTED' || r.status === 'CANCELLED',
  ).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reservas</h1>
          <p className="page-subtitle">Gestão de reservas e aprovações</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            height: '38px',
            padding: '0 16px',
            borderRadius: 'var(--radius-s)',
            background: 'var(--color-brand)',
            color: '#fff',
            border: 'none',
            fontFamily: 'inherit',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Plus size={15} />
          {showForm ? 'Fechar' : 'Nova reserva'}
        </button>
      </div>

      {/* Formulário de nova reserva */}
      {showForm && (
        <div
          style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '24px',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow-s)',
              padding: '20px',
              flex: '0 0 auto',
              width: '100%',
              maxWidth: '520px',
            }}
          >
            {/* S6 — Seletor de data (fluxo data → sala → form). */}
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}
            >
              <label htmlFor="sel-data" style={labelStyle}>
                Data *
              </label>
              <input
                id="sel-data"
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                min={todayYmd()}
                style={inputStyle}
              />
            </div>

            {/* Seletor de sala + turma */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="sel-sala" style={labelStyle}>
                  Sala *
                </label>
                <select
                  id="sel-sala"
                  value={sala}
                  onChange={e => setSala(e.target.value)}
                  style={inputStyle}
                >
                  {SALAS.map(s => {
                    const st = statusDaSala(s);
                    const ocupada = st !== 'livre';
                    return (
                      <option key={s} value={s} disabled={ocupada}>
                        {s}
                        {ocupada ? ` (${st})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="sel-turma" style={labelStyle}>
                  Turma
                </label>
                <input
                  id="sel-turma"
                  type="text"
                  value={turma}
                  onChange={e => setTurma(e.target.value)}
                  placeholder="Ex: ADS-2A"
                  style={inputStyle}
                />
              </div>
            </div>

            <ReservationForm
              key={`${sala}-${selectedDate}`}
              roomId={sala}
              salaName={sala}
              userId={CURRENT_USER.userId}
              userEmail={CURRENT_USER.userEmail}
              professor={CURRENT_USER.professor}
              turma={turma}
              service={service}
              onCancel={() => setShowForm(false)}
              onSuccess={() => list.refetch()}
              initialValues={{
                data: selectedDate,
                inicio: '',
                fim: '',
                observacao: '',
              }}
              registros={registros}
              reservas={reservas}
            />
          </div>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <RoomAvailabilityPanel sala={sala} eventos={eventosParaPanel} />
          </div>
        </div>
      )}

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        {[
          {
            label: 'Total',
            value: reservations.length,
            color: 'var(--color-blue)',
            bg: 'var(--color-blue-l)',
            Icon: FileText,
          },
          {
            label: 'Pendentes',
            value: pending,
            color: 'var(--color-amber)',
            bg: 'var(--color-amber-l)',
            Icon: Clock,
          },
          {
            label: 'Aprovadas',
            value: approved,
            color: 'var(--color-green)',
            bg: 'var(--color-green-l)',
            Icon: CheckCircle2,
          },
          {
            label: 'Rejeitadas',
            value: rejected,
            color: 'var(--color-red)',
            bg: 'var(--color-red-l)',
            Icon: XCircle,
          },
        ].map(({ label, value, color, bg, Icon }) => (
          <div
            key={label}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: '14px 16px',
              boxShadow: 'var(--shadow-s)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: bg,
                color,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Icon size={16} />
            </span>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1, color }}>{value}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: 2 }}>
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-s)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '13px' }}>Todas as reservas</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 20,
              background: 'var(--color-blue-l)',
              color: 'var(--color-blue)',
            }}
          >
            {reservations.length} registros
          </span>
        </div>
        <ReservationList showApproval />
      </div>

      {/* Calendário (sub-etapa 4.1a — lê via useListReservations) */}
      <ReservationCalendar
        events={events}
        loading={list.status === 'loading'}
        error={list.error?.message ?? null}
        onRefresh={() => list.refetch()}
        onEventClick={r => setSelectedReservation(r)}
      />

      {/* Modal de detalhes (4.2b — cancel 2 cliques + owner-check). Sprint 4 D3 — wiring de edit. */}
      <ReservationDetailsModal
        reservation={selectedReservation}
        onClose={() => {
          setSelectedReservation(null);
          cancelMutation.reset();
        }}
        currentUserEmail={CURRENT_USER.userEmail}
        onConfirmCancel={handleConfirmCancel}
        cancelStatus={cancelMutation.status}
        cancelError={cancelMutation.error}
        onCancelReset={() => cancelMutation.reset()}
        service={service}
        userId={CURRENT_USER.userId}
        {...(groupDates !== undefined && { groupDates })}
        {...(groupIdMap !== undefined && { groupIdMap })}
        onEditSuccess={() => {
          void list.refetch();
        }}
      />
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-muted)',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
};

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
