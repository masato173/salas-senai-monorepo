import type { EventInput } from '@fullcalendar/core';
import type { CreatedReservationRow } from '../../services/appsScript';

// Mapper puro: CreatedReservationRow → EventInput.
// Não constrói Date — passa string ISO local sem timezone suffix.
// FullCalendar resolve o parsing via timeZone='America/Manaus' configurado no calendar.
// Determinístico independente do timezone do browser.
export function reservationToEvent(r: CreatedReservationRow): EventInput {
  return {
    id:    r.id,
    title: `${r.sala} · ${r.turma}`,
    start: `${r.data}T${r.inicio}:00`,
    end:   `${r.data}T${r.fim}:00`,
  };
}
