import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type ReservationAuditAction =
  | 'CREATE_RESERVATION'
  | 'UPDATE_RESERVATION'
  | 'DELETE_RESERVATION'
  | 'APPROVE_RESERVATION'
  | 'REJECT_RESERVATION';

export type RoomAuditAction = 'CREATE_ROOM' | 'UPDATE_ROOM' | 'DEACTIVATE_ROOM';

export type AuditAction = ReservationAuditAction | RoomAuditAction;
export type AuditEntityType = 'Reservation' | 'Room';

interface AuditParams {
  action: AuditAction;
  // Default 'Reservation' — preserva compatibilidade com as chamadas
  // existentes em reservations.service.ts, que não precisam passar isso.
  entityType?: AuditEntityType;
  entityId: string;
  userId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  // Sempre chamado dentro de $transaction — recebe o cliente transacional.
  async log(tx: Prisma.TransactionClient, params: AuditParams): Promise<void> {
    await tx.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType ?? 'Reservation',
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
