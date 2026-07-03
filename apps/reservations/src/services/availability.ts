import type {
  RegistroLegado,
  Turno,
  SalaEvento,
  DisponibilidadeSala,
  RoomStatus,
  AvailabilityResult,
} from '../types';
import type { CreatedReservationRow } from './appsScript';

// Sprint Disponibilidade S2 — mapper puro, testável em isolamento (Vitest).
// Sem React, sem fetch, sem efeitos colaterais.
//
// Regra crítica (CLAUDE.md): fórmula canônica de sobreposição
//   inicio1 < fim2 && fim1 > inicio2
// Cobre overlap parcial, total e containment.
// Bordas iguais não conflitam (start === end é tangência, não overlap).

// Horários das AULAS por turno — uso INTERNO ao mapper.
// As reservas têm horário livre (06:00-23:00, usuário escolhe).
// Este mapa converte turno→faixa apenas pra cruzar aula×reserva.
const TURNO_HORARIO: Record<Turno, { inicio: string; fim: string }> = {
  M: { inicio: '07:30', fim: '12:00' },
  V: { inicio: '13:00', fim: '17:30' },
  N: { inicio: '18:30', fim: '22:00' },
};

/** HH:MM → minutos desde meia-noite. Sem Date, sem timezone. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Verifica sobreposição de dois intervalos HH:MM.
 * Fórmula canônica (CLAUDE.md): inicio1 < fim2 && fim1 > inicio2
 * Cobre: overlap parcial, total e containment.
 */
export function overlaps(
  a: { inicio: string; fim: string },
  b: { inicio: string; fim: string },
): boolean {
  return toMinutes(a.inicio) < toMinutes(b.fim) && toMinutes(a.fim) > toMinutes(b.inicio);
}

/**
 * Monta visão unificada de disponibilidade para um dia.
 *
 * @param registros - RegistroLegado[] de fetchSchedule
 * @param reservas  - CreatedReservationRow[] de listReservations
 *                    (filtragem defensiva de CANCELLED aplicada internamente)
 * @param data      - YYYY-MM-DD consultado
 * @param salas     - lista oficial de salas (SALAS do config, readonly)
 * @param turno     - filtro de turno (undefined = dia todo)
 */
export function buildRoomAvailability(
  registros: RegistroLegado[],
  reservas: CreatedReservationRow[],
  data: string,
  salas: readonly string[],
  turno?: Turno,
): AvailabilityResult {
  const registrosDia = registros.filter(r => r.data === data);
  // Filtragem defensiva: exclui CANCELLED mesmo que o caller não tenha filtrado.
  const reservasDia = reservas.filter(r => r.data === data && r.status !== 'CANCELLED');

  const salaMap: DisponibilidadeSala[] = salas.map(sala => {
    const eventos: SalaEvento[] = [];

    // Aulas
    for (const aula of registrosDia.filter(r => r.sala === sala)) {
      if (turno && aula.turno !== turno) continue;
      // turno=null → bloqueia dia todo (conservador — S4 previne na origem).
      const horario = aula.turno !== null ? TURNO_HORARIO[aula.turno] : null;
      eventos.push({
        tipo: 'aula',
        sala,
        data,
        inicio: horario?.inicio ?? '00:00',
        fim: horario?.fim ?? '23:59',
        turno: aula.turno,
        turma: aula.turma,
      });
    }

    // Reservas (não CANCELLED)
    for (const res of reservasDia.filter(r => r.sala === sala)) {
      if (turno) {
        // Reserva tem horário livre: só inclui se sobrepõe à faixa do turno.
        if (!overlaps({ inicio: res.inicio, fim: res.fim }, TURNO_HORARIO[turno])) {
          continue;
        }
      }
      eventos.push({
        tipo: 'reserva',
        sala,
        data,
        inicio: res.inicio,
        fim: res.fim,
        professor: res.professor,
        id: res.id,
      });
    }

    // Status dominante (pior caso: conflito > aula > reserva > livre).
    const temAula = eventos.some(e => e.tipo === 'aula');
    const temReserva = eventos.some(e => e.tipo === 'reserva');
    let status: RoomStatus = 'livre';
    if (temAula && temReserva) status = 'conflito';
    else if (temAula) status = 'aula';
    else if (temReserva) status = 'reserva';

    return { sala, status, eventos };
  });

  return {
    data,
    ...(turno !== undefined && { turno }),
    salas: salaMap,
    geradoEm: new Date().toISOString(),
  };
}

/**
 * Retorna o status de UMA sala num horário específico.
 * Diferente de buildRoomAvailability (dia inteiro) — verifica
 * o intervalo exato inicio-fim para uso no preview de período.
 *
 * Fórmula canônica (via overlaps): newIni < existingFim && newFim > existingIni.
 * Reusa o TURNO_HORARIO já declarado no topo do módulo.
 */
export function getStatusParaHorario(
  registros: RegistroLegado[],
  reservas: CreatedReservationRow[],
  sala: string,
  data: string,
  inicio: string,
  fim: string,
): RoomStatus {
  const registrosDia = registros.filter(r => r.data === data && r.sala === sala);
  const reservasDia = reservas.filter(
    r => r.data === data && r.sala === sala && r.status !== 'CANCELLED',
  );

  const req = { inicio, fim };

  const temAula = registrosDia.some(r => {
    // turno=null → bloqueia dia inteiro (mesma política conservadora do mapper).
    const h = r.turno !== null ? TURNO_HORARIO[r.turno] : null;
    const aulaSlot = h ?? { inicio: '00:00', fim: '23:59' };
    return overlaps(req, aulaSlot);
  });

  const temReserva = reservasDia.some(r => overlaps(req, r));

  if (temAula && temReserva) return 'conflito';
  if (temAula) return 'aula';
  if (temReserva) return 'reserva';
  return 'livre';
}
