import type { EventInput } from '@fullcalendar/core';
import type { CreatedReservationRow } from '../../services/appsScript';

// Shape consumido pelo ReservationDetailsModal (4.2a) e pelo cancel (4.2b).
// Espelha exatamente os campos populados em extendedProps + id do evento.
export interface ReservationDetails {
  id?:        string;
  sala:       string;
  data:       string;
  inicio:     string;
  fim:        string;
  professor:  string;
  observacao: string;
  createdBy:  string;
}

// Mapper puro: CreatedReservationRow → EventInput.
// Não constrói Date — passa string ISO local sem timezone suffix.
// FullCalendar resolve o parsing via timeZone='America/Manaus' configurado no calendar.
// Determinístico independente do timezone do browser.
// extendedProps carrega os campos consumidos pelo ReservationDetailsModal (4.2a)
// e pelo owner-check antecipado do botão Cancelar (4.2b — usa createdBy).
export function reservationToEvent(r: CreatedReservationRow): EventInput {
  return {
    id:    r.id,
    title: `${r.sala} · ${r.turma}`,
    start: `${r.data}T${r.inicio}:00`,
    end:   `${r.data}T${r.fim}:00`,
    extendedProps: {
      sala:       r.sala,
      data:       r.data,
      inicio:     r.inicio,
      fim:        r.fim,
      professor:  r.professor,
      observacao: r.observacao,
      createdBy:  r.createdBy,
    },
  };
}
