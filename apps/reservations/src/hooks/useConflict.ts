import { hasConflict } from '../validators/conflict';
import type { Reservation } from '../types';

const ACTIVE_STATUSES = ['PENDING', 'APPROVED'] as const;

/**
 * Detecta reservas que conflitam com um novo pedido.
 *
 * Regras:
 * - Mesma sala
 * - Mesma data
 * - Horários se sobrepõem
 * - Status ativo (PENDING ou APPROVED)
 * - Exclui a própria reserva quando editando (excludeId)
 */
export function detectConflicts(
  existing: Reservation[],
  candidate: { roomId: string; date: string; start: string; end: string },
  excludeId?: string,
): Reservation[] {
  return existing.filter(r => {
    if (r.id === excludeId)                          return false;
    if (r.roomId !== candidate.roomId)               return false;
    if (r.date   !== candidate.date)                 return false;
    if (!(ACTIVE_STATUSES as readonly string[]).includes(r.status)) return false;

    return hasConflict(
      { start: candidate.start, end: candidate.end },
      { start: r.start,         end: r.end         },
    );
  });
}

/**
 * Hook React para uso em componentes.
 * A lógica pura está em detectConflicts — testável sem React.
 */
export function useConflict() {
  return { detectConflicts };
}
