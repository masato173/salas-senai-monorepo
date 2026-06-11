import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import type { EventInput } from '@fullcalendar/core';
import { RefreshCw, AlertCircle } from 'lucide-react';

// Sub-etapa 4.1a — componente "burro": recebe events/loading/error via props.
// Dados vivem em useListReservations(service) na página /reservas.
// Click no evento (modal de detalhes + Cancelar) é 4.2.

interface ReservationCalendarProps {
  events:     EventInput[];
  loading?:   boolean;
  error?:     string | null;
  onRefresh?: () => void;
}

export function ReservationCalendar({
  events,
  loading = false,
  error   = null,
  onRefresh,
}: ReservationCalendarProps) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-s)',
      padding: '16px',
      marginTop: '24px',
    }}>
      {/* Faixa de erro (padrão ReservationForm) */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '8px',
          borderRadius: 'var(--radius-s)', border: '1px solid var(--color-red)',
          background: 'var(--color-red-l)', padding: '10px 14px',
          marginBottom: '12px',
        }}>
          <AlertCircle size={14} style={{ color: 'var(--color-red)', flexShrink: 0, marginTop: '1px' }} />
          <span style={{ fontSize: '12px', color: 'var(--color-red)' }}>{error}</span>
        </div>
      )}

      {/* Toolbar interno: status loading (esq) + botão Atualizar (dir) */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '12px', minHeight: '28px',
      }}>
        <span style={{
          fontSize: '11px', color: 'var(--color-muted)',
          visibility: loading ? 'visible' : 'hidden',
        }}>
          Carregando reservas…
        </span>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            style={{
              height: '28px', padding: '0 10px', borderRadius: 'var(--radius-s)',
              background: 'var(--color-surface)', color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: '6px',
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
          left:   'prev,next today',
          center: 'title',
          right:  'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        locale={ptBrLocale}
        timeZone="America/Manaus"
        height={600}
        events={events}
      />
    </div>
  );
}
