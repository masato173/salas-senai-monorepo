import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';

// Sub-etapa 4.0 — fumaça. Sem eventos, sem hooks, sem click handlers.
// Próxima sub-etapa (4.1) injeta useListReservations → events.
export function ReservationCalendar() {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-s)',
      padding: '16px',
      marginTop: '24px',
    }}>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left:   'prev,next today',
          center: 'title',
          right:  'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        locale={ptBrLocale}
        timeZone="America/Manaus"
        height={600}
      />
    </div>
  );
}
