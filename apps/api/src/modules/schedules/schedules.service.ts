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

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<ScheduleResult> {
    const schedules = await this.prisma.schedule.findMany({
      orderBy: [{ date: 'asc' }, { sala: 'asc' }],
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

    // Reconstrói turnoMap a partir dos registros (turma → turno)
    const turnoMap: Record<string, string> = {};
    for (const s of schedules) {
      if (s.turno !== null && s.turma !== '') {
        turnoMap[s.turma] = s.turno;
      }
    }

    return { registros, turnoMap };
  }
}
