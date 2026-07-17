import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationStatus } from '@prisma/client';

export interface DashboardResult {
  date: string;
  totalSalas: number;
  salasComAula: number;
  salasLivres: number;
  aulasHoje: number;
  reservasHoje: number;
  reservasPendentes: number;
  reservasAprovadas: number;
  ocupacaoPercent: number;
  porTurno: { M: number; V: number; N: number };
  geradoEm: string;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(date: string): Promise<DashboardResult> {
    // 1. Total de salas ativas
    const totalSalas = await this.prisma.room.count({
      where: { available: true },
    });

    // 2. Aulas do dia por turno
    const aulas = await this.prisma.schedule.groupBy({
      by: ['sala', 'turno'],
      where: { date },
    });

    const aulasHoje = aulas.length;
    const salasComAulaSet = new Set(aulas.map(a => a.sala));
    const salasComAula = salasComAulaSet.size;
    const salasLivres = Math.max(0, totalSalas - salasComAula);

    // 3. Ocupação por turno (aulas)
    const porTurno = { M: 0, V: 0, N: 0 };
    for (const a of aulas) {
      if (a.turno === 'M') porTurno.M++;
      else if (a.turno === 'V') porTurno.V++;
      else if (a.turno === 'N') porTurno.N++;
    }

    // 4. Reservas do dia
    const [reservasHoje, reservasPendentes, reservasAprovadas] = await Promise.all([
      this.prisma.reservation.count({
        where: {
          date,
          deletedAt: null,
          status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] },
        },
      }),
      this.prisma.reservation.count({
        where: { status: ReservationStatus.PENDING, deletedAt: null },
      }),
      this.prisma.reservation.count({
        where: { status: ReservationStatus.APPROVED, deletedAt: null },
      }),
    ]);

    // 5. Ocupação %: salas com atividade / total
    const ocupacaoPercent = totalSalas > 0 ? Math.round((salasComAula / totalSalas) * 100) : 0;

    return {
      date,
      totalSalas,
      salasComAula,
      salasLivres,
      aulasHoje,
      reservasHoje,
      reservasPendentes,
      reservasAprovadas,
      ocupacaoPercent,
      porTurno,
      geradoEm: new Date().toISOString(),
    };
  }
}
