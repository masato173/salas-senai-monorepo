import { useMemo } from 'react';
import type { RegistroLegado, Turno, AvailabilityResult } from '../types';
import type { CreatedReservationRow } from '../services/appsScript';
import { buildRoomAvailability } from '../services/availability';

// Sprint Disponibilidade S3 — hook derivado (Forma B).
// NÃO faz fetch — recebe dados já carregados pelo orquestrador.
// O orquestrador passa:
//   registros = useSchedule(service).data?.registros ?? []
//   reservas  = useListReservations(service).data?.reservations ?? []
//   data      = YYYY-MM-DD a consultar
//   salas     = SALAS do config (readonly string[])
//   turno     = filtro opcional

export function useAvailability(
  registros: RegistroLegado[],
  reservas: CreatedReservationRow[],
  data: string,
  salas: readonly string[],
  turno?: Turno,
): AvailabilityResult {
  return useMemo(
    () => buildRoomAvailability(registros, reservas, data, salas, turno),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registros, reservas, data, salas, turno],
  );
}

// Nota sobre deps: registros e reservas são arrays — React compara por
// referência. O orquestrador DEVE memoizar esses arrays (useMemo) pra
// evitar recálculo desnecessário do buildRoomAvailability a cada render.
// Exemplo correto no orquestrador:
//   const registros = useMemo(() => schedule.data?.registros ?? [], [schedule.data]);
//   const reservas  = useMemo(() => list.data?.reservations ?? [],  [list.data]);
