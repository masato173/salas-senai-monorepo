import type { EventInput } from '@fullcalendar/core';
import type { CreatedReservationRow } from '../../services/apiTypes';

// Shape consumido pelo ReservationDetailsModal (4.2a) e pelo cancel (4.2b).
// Espelha exatamente os campos populados em extendedProps + id do evento.
// Sprint 4 Fase B: groupId obrigatório (mapper sempre injeta — '' pra linhas legacy).
// Sprint 4 Fase D3: turma obrigatório (necessário pro initialValues do form em modo edit).
export interface ReservationDetails {
  id?: string;
  sala: string;
  data: string;
  inicio: string;
  fim: string;
  professor: string;
  turma: string;
  observacao: string;
  createdBy: string;
  groupId: string;
}

// Mapper puro: CreatedReservationRow → EventInput.
// Não constrói Date — passa string ISO local sem timezone suffix.
// FullCalendar resolve o parsing via timeZone='America/Manaus' configurado no calendar.
// Determinístico independente do timezone do browser.
// extendedProps carrega os campos consumidos pelo ReservationDetailsModal (4.2a)
// e pelo owner-check antecipado do botão Cancelar (4.2b — usa createdBy).
export function reservationToEvent(r: CreatedReservationRow): EventInput {
  return {
    id: r.id,
    title: `${r.sala} · ${r.turma}`,
    start: `${r.data}T${r.inicio}:00`,
    end: `${r.data}T${r.fim}:00`,
    extendedProps: {
      sala: r.sala,
      data: r.data,
      inicio: r.inicio,
      fim: r.fim,
      professor: r.professor,
      turma: r.turma,
      observacao: r.observacao,
      createdBy: r.createdBy,
      groupId: r.groupId ?? '',
    },
  };
}

// Regra de domínio (Sprint 4 Fase B): classifica uma reserva como "de período"
// (parte de um grupo de N reservas multi-dia) ou "única".
//
// Backend (Fase A):
//   • createReservation (única)       → groupId === id
//   • createReservationRange (período) → groupId === UUID compartilhado, !== id
//   • Linhas pré-Fase-A (legacy)       → groupId === ''
//
// A função é o ponto único de verdade dessa distinção. O modal usa pra renderizar
// o selo "Período"; a Fase D (editar) vai reusar pra decidir "editar única vs grupo".
//
// Retorna true APENAS no caso período. Legacy retorna false — sem groupId não dá
// pra afirmar "é grupo"; assume-se única conservadoramente.
export function isRangeReservation(id: string, groupId: string): boolean {
  return groupId !== '' && groupId !== id;
}
