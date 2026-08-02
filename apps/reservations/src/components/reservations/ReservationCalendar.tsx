import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import type { EventInput } from '@fullcalendar/core';
import { RefreshCw, AlertCircle } from 'lucide-react';
import type { ReservationDetails } from './reservationToEvent';

// Sub-etapa 4.1a — componente "burro": recebe events/loading/error via props.
// Dados vivem em useListReservations(service) na página /reservas.
// Sub-etapa 4.2a — adiciona onEventClick: extrai id+extendedProps e repassa pro pai.
// Continua burro (não abre modal, não guarda estado).

interface ReservationCalendarProps {
  events: EventInput[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onEventClick?: (reservation: ReservationDetails) => void;
}

export function ReservationCalendar({
  events,
  loading = false,
  error = null,
  onRefresh,
  onEventClick,
}: ReservationCalendarProps) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        backdropFilter: 'blur(var(--glass-blur-s)) saturate(140%)',
        WebkitBackdropFilter: 'blur(var(--glass-blur-s)) saturate(140%)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-s), var(--glass-sheen)',
        padding: '16px',
        marginTop: '24px',
      }}
    >
      {/* Faixa de erro (padrão ReservationForm) */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            borderRadius: 'var(--radius-s)',
            border: '1px solid var(--color-red)',
            background: 'var(--color-red-l)',
            padding: '10px 14px',
            marginBottom: '12px',
          }}
        >
          <AlertCircle
            size={14}
            style={{ color: 'var(--color-red)', flexShrink: 0, marginTop: '1px' }}
          />
          <span style={{ fontSize: '12px', color: 'var(--color-red)' }}>{error}</span>
        </div>
      )}

      {/* Toolbar interno: status loading (esq) + botão Atualizar (dir) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          minHeight: '28px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            color: 'var(--color-muted)',
            visibility: loading ? 'visible' : 'hidden',
          }}
        >
          Carregando reservas…
        </span>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            style={{
              height: '28px',
              padding: '0 10px',
              borderRadius: 'var(--radius-s)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              fontFamily: 'inherit',
              fontSize: '12px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={12} />
            Atualizar
          </button>
        )}
      </div>

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        locale={ptBrLocale}
        timeZone="America/Manaus"
        height={600}
        dayMaxEvents
        events={events}
        eventClick={info => {
          // Cast seguro: o mapper (reservationToEvent) é a única fonte que popula
          // extendedProps. Testes do mapper (6, 7, 8) garantem o shape exato.
          onEventClick?.({
            id: info.event.id,
            ...(info.event.extendedProps as Omit<ReservationDetails, 'id'>),
          });
        }}
      />
    </div>
  );
}
