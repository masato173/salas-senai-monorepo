import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Reservation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  // Verifica só a permissão (owner ou role privilegiada), sem checar
  // existência/soft-delete — usada quando o chamador já tem o objeto em mãos
  // (ex.: reserva já soft-deleted, que assertCanModify trataria como "não
  // encontrada") e só precisa da regra de quem pode modificar.
  //
  // Regra (ADR-006, issue 6):
  // - ADMIN e COORDENADOR podem modificar QUALQUER reserva (editar e
  //   cancelar, inclusive em lote) — mesmo nível que já têm para aprovar/
  //   rejeitar (PATCH /reservations/:id/status). O bypass do COORDENADOR é
  //   intencional; as ações dele têm limite de requisições próprio
  //   (CoordinatorActionsThrottleGuard).
  // - Owner (userId === currentUser.userId) pode modificar a sua.
  // - Qualquer outro: ForbiddenException.
  // currentUser.role vem do banco (JwtStrategy), não do token.
  // Matriz travada em ownership.service.spec.ts.
  assertOwnerOrPrivileged(reservation: Reservation, currentUser: RequestUser): void {
    if (currentUser.role === 'ADMIN' || currentUser.role === 'COORDENADOR') return;

    if (reservation.userId !== currentUser.userId) {
      throw new ForbiddenException('Você não tem permissão para modificar esta reserva.');
    }
  }

  // Retorna a reserva se o usuário pode modificá-la. Lança NotFoundException
  // se não existir ou estiver soft-deleted (não confunda com "sem permissão"
  // — ver assertOwnerOrPrivileged para essa checagem isolada).
  async assertCanModify(reservationId: string, currentUser: RequestUser): Promise<Reservation> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation || reservation.deletedAt !== null) {
      throw new NotFoundException(`Reserva "${reservationId}" não encontrada.`);
    }

    this.assertOwnerOrPrivileged(reservation, currentUser);

    return reservation;
  }
}
