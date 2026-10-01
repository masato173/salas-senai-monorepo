import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Turno = 'M' | 'V' | 'N';

export interface RegistroLegado {
  data: string;
  sala: string;
  turma: string;
  mes: string;
  turno: Turno | null;
  inicio: string | null; // HH:MM — inferido do turno no sync (F8.1)
  fim: string | null; // HH:MM — inferido do turno no sync (F8.1)
}

export interface ScheduleResult {
  registros: RegistroLegado[];
  turnoMap: Record<string, string>;
}

export interface GetSchedulesParams {
  page?: number | undefined;
  pageSize?: number | undefined;
}

// Teto aplicado quando não há paginação válida — endpoint é @Public, um
// chamador anônimo nunca leva a tabela sem limite. Hoje são ~1.522 registros
// e o frontend (Reservas, Admin/Sync) precisa do conjunto inteiro: rever
// esse valor se a tabela se aproximar dele.
export const SCHEDULE_MAX_ROWS = 5000;

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(params: GetSchedulesParams = {}): Promise<ScheduleResult> {
    const { page, pageSize } = params;

    // Mesma regra de ReservationsService.findAll: paginação só se page E
    // pageSize vierem válidos (page >= 1, 1 <= pageSize <= 200).
    const paginate =
      page !== undefined && pageSize !== undefined && page >= 1 && pageSize >= 1 && pageSize <= 200;

    const window: { skip?: number; take: number } = paginate
      ? { skip: (page - 1) * pageSize, take: pageSize }
      : { take: SCHEDULE_MAX_ROWS };

    const schedules = await this.prisma.schedule.findMany({
      orderBy: [{ date: 'asc' }, { sala: 'asc' }],
      ...window,
    });

    const registros: RegistroLegado[] = schedules.map(s => ({
      data: s.date,
      sala: s.sala,
      turma: s.turma,
      mes: s.mes,
      turno: (s.turno as Turno | null) ?? null,
      inicio: s.inicio ?? null,
      fim: s.fim ?? null,
    }));

    // Reconstrói turnoMap a partir dos registros retornados (turma → turno)
    const turnoMap: Record<string, string> = {};
    for (const s of schedules) {
      if (s.turno !== null && s.turma !== '') {
        turnoMap[s.turma] = s.turno;
      }
    }

    return { registros, turnoMap };
  }
}
