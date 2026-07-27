import { Injectable, BadRequestException } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Tipos espelhados do frontend (apps/reservations/src/types/index.ts)
// Shape idêntico para compatibilidade direta com o frontend.
type Turno = 'M' | 'V' | 'N';
type RoomStatus = 'livre' | 'aula' | 'reserva' | 'conflito';

interface SalaEvento {
  tipo: 'aula' | 'reserva';
  sala: string;
  data: string;
  inicio: string;
  fim: string;
  turno?: Turno | null;
  turma?: string;
  professor?: string;
  id?: string;
}

interface DisponibilidadeSala {
  sala: string;
  status: RoomStatus;
  eventos: SalaEvento[];
}

export interface AvailabilityResult {
  data: string;
  turno?: Turno;
  salas: DisponibilidadeSala[];
  geradoEm: string;
}

// Faixa de horário por turno — paridade exata com TURNO_HORARIO do frontend.
const TURNO_HORARIO: Record<Turno, { inicio: string; fim: string }> = {
  M: { inicio: '07:00', fim: '12:30' },
  V: { inicio: '13:00', fim: '18:00' },
  N: { inicio: '18:00', fim: '22:00' },
};

// HH:MM → minutos. Paridade exata com toMinutes() do frontend.
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Type guard para valores válidos de Turno
function isTurno(t: string | null): t is Turno {
  return t === 'M' || t === 'V' || t === 'N';
}

// Verifica sobreposição. Paridade exata com overlaps() do frontend.
// Fórmula canônica: inicio1 < fim2 && fim1 > inicio2
// Bordas iguais NÃO conflitam (tangência).
function overlaps(a: { inicio: string; fim: string }, b: { inicio: string; fim: string }): boolean {
  return toMinutes(a.inicio) < toMinutes(b.fim) && toMinutes(a.fim) > toMinutes(b.inicio);
}

export interface GetAvailabilityParams {
  date: string;
  turno?: Turno | undefined;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailability(params: GetAvailabilityParams): Promise<AvailabilityResult> {
    const { date, turno } = params;

    // Todas as salas ativas, ordem alfabética (paridade com SALAS[] do frontend)
    const rooms = await this.prisma.room.findMany({
      where: { available: true },
      orderBy: { name: 'asc' },
    });

    // Reservas ativas no dia — só APPROVED entra na disponibilidade.
    // PENDING não deve aparecer aqui (sala não está de fato ocupada até
    // a aprovação); ConflictService continua considerando PENDING+APPROVED
    // pra bloquear double-booking — contexto diferente, não mexer lá.
    const reservations = await this.prisma.reservation.findMany({
      where: {
        date,
        status: ReservationStatus.APPROVED,
        deletedAt: null,
      },
      include: {
        user: { select: { name: true } },
      },
    });

    // Aulas do dia (Schedule) — filtradas por turno se especificado.
    // Paridade com buildRoomAvailability do frontend:
    //   turno especificado → só aulas daquele turno (null excluído)
    //   sem turno → todas as aulas do dia
    const schedules = await this.prisma.schedule.findMany({
      where: {
        date,
        ...(turno !== undefined ? { turno } : {}),
      },
    });

    const salas: DisponibilidadeSala[] = rooms.map(room => {
      const roomReservations = reservations.filter(r => r.roomId === room.id);
      const roomSchedules = schedules.filter(s => s.sala === room.name);

      const eventos: SalaEvento[] = [];

      // Aulas (tipo: 'aula')
      // Prioriza inicio/fim do banco (preenchidos no sync F8.1).
      // Fallback para TURNO_HORARIO caso campos ainda sejam null (registros legados).
      for (const s of roomSchedules) {
        const horario = isTurno(s.turno) ? TURNO_HORARIO[s.turno] : null;
        const inicio = s.inicio ?? horario?.inicio ?? '00:00';
        const fim = s.fim ?? horario?.fim ?? '23:59';
        eventos.push({
          tipo: 'aula' as const,
          sala: room.name,
          data: date,
          inicio,
          fim,
          turno: isTurno(s.turno) ? s.turno : null,
          turma: s.turma,
        });
      }

      // Reservas (tipo: 'reserva') — filtradas por turno se especificado
      const filteredReservations = roomReservations.filter(r => {
        if (turno === undefined) return true;
        return overlaps({ inicio: r.inicio, fim: r.fim }, TURNO_HORARIO[turno]);
      });

      for (const r of filteredReservations) {
        eventos.push({
          tipo: 'reserva' as const,
          sala: room.name,
          data: r.date,
          inicio: r.inicio,
          fim: r.fim,
          professor: r.user.name,
          id: r.id,
          // turma é opcional em Reservation (String?) — guard !== null, não
          // !== undefined, porque o Prisma tipa campo nullable como T|null
          // (exactOptionalPropertyTypes — padrão do projeto).
          ...(r.turma !== null ? { turma: r.turma } : {}),
        });
      }

      // Status dominante (pior caso: conflito > aula > reserva > livre).
      // 'conflito' exige SOBREPOSIÇÃO REAL de horário entre aula e reserva
      // (reutiliza overlaps(), a mesma fórmula canônica do resto do
      // projeto) — antes bastava ter os dois tipos no dia sem checar
      // horário, o que gerava falso positivo (ex.: aula de manhã + reserva
      // à tarde na mesma sala virava "conflito" sem sobreposição real,
      // divergindo do ConflictService, que aceitava a reserva).
      const aulas = eventos.filter(e => e.tipo === 'aula');
      const reservasDoDia = eventos.filter(e => e.tipo === 'reserva');
      const temConflitoReal = aulas.some(a => reservasDoDia.some(r => overlaps(a, r)));

      let status: RoomStatus = 'livre';
      if (temConflitoReal) status = 'conflito';
      else if (aulas.length > 0) status = 'aula';
      else if (reservasDoDia.length > 0) status = 'reserva';

      return { sala: room.name, status, eventos };
    });

    return {
      data: date,
      ...(turno !== undefined ? { turno } : {}),
      salas,
      geradoEm: new Date().toISOString(),
    };
  }

  // Valida query params — centralizado no service para manter controller limpo
  static validateParams(
    date: string | undefined,
    turno: string | undefined,
  ): { date: string; turno?: Turno } {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Parâmetro "date" é obrigatório no formato YYYY-MM-DD.');
    }
    if (turno !== undefined && !['M', 'V', 'N'].includes(turno)) {
      throw new BadRequestException('Parâmetro "turno" deve ser M, V ou N.');
    }
    return {
      date,
      ...(turno !== undefined ? { turno: turno as Turno } : {}),
    };
  }
}
