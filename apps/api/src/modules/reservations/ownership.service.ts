import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Reservation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  // Retorna a reserva se o usuário pode modificá-la.
  // ADMIN pode modificar qualquer reserva.
  // Owner (userId === currentUser.userId) pode modificar a sua.
  // Qualquer outro: ForbiddenException.
  async assertCanModify(reservationId: string, currentUser: RequestUser): Promise<Reservation> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation || reservation.deletedAt !== null) {
      throw new NotFoundException(`Reserva "${reservationId}" não encontrada.`);
    }

    if (currentUser.role === 'ADMIN') return reservation;

    if (reservation.userId !== currentUser.userId) {
      throw new ForbiddenException('Você não tem permissão para modificar esta reserva.');
    }

    return reservation;
  }
}
