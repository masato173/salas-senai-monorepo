import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Reservation } from '@prisma/client';

export type ReservationAuditAction =
  | 'CREATE_RESERVATION'
  | 'UPDATE_RESERVATION'
  | 'DELETE_RESERVATION';

interface AuditParams {
  action: ReservationAuditAction;
  entityId: string;
  userId: string;
  before?: Partial<Reservation>;
  after?: Partial<Reservation>;
}

@Injectable()
export class AuditService {
  // Sempre chamado dentro de $transaction — recebe o cliente transacional.
  async log(tx: Prisma.TransactionClient, params: AuditParams): Promise<void> {
    await tx.auditLog.create({
      data: {
        action: params.action,
        entityType: 'Reservation',
        entityId: params.entityId,
        userId: params.userId,
        before:
          params.before !== undefined ? (params.before as Prisma.InputJsonValue) : Prisma.JsonNull,
        after:
          params.after !== undefined ? (params.after as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }
}
