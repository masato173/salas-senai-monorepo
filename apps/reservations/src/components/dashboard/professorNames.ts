import type { DayReservationItem } from '../../services/apiTypes';
import type { DisponibilidadeSala } from '../../types';

// Issue 5 (fase 2) — /availability é público e não traz nome de pessoa.
// Pra usuário autenticado, o Dashboard complementa os eventos de reserva com
// o nome do professor responsável vindo de GET /reservations/day
// (autenticado), unindo pelo id da reserva. Visitante anônimo: mapa vazio,
// nenhum nome em lugar nenhum.

export function shouldFetchNames(accessToken: string | null): boolean {
  return accessToken !== null && accessToken !== '';
}

export function buildProfessorNameMap(items: readonly DayReservationItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    if (item.professor !== undefined) map.set(item.id, item.professor);
  }
  return map;
}

// Cópia das salas com `professor` só nos eventos de reserva que têm
// correspondência por id. Aula nunca recebe nome; sem correspondência, o
// evento fica como veio (sem nome, sem erro).
export function withProfessorNames(
  salas: readonly DisponibilidadeSala[],
  names: ReadonlyMap<string, string>,
): DisponibilidadeSala[] {
  if (names.size === 0) return [...salas];
  return salas.map(sala => ({
    ...sala,
    eventos: sala.eventos.map(ev => {
      if (ev.tipo !== 'reserva' || ev.id === undefined) return ev;
      const nome = names.get(ev.id);
      return nome !== undefined ? { ...ev, professor: nome } : ev;
    }),
  }));
}

export function professorLabel(name: string): string {
  return `Prof. ${name}`;
}
