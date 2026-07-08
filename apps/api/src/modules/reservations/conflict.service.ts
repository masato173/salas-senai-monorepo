import { Injectable } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface ConflictParams {
  roomId: string;
  date: string;
  inicio: string; // HH:MM — comparação lexicográfica é válida para strings zero-padded
  fim: string; // HH:MM
  excludeId?: string;
}

@Injectable()
export class ConflictService {
  constructor(private readonly prisma: PrismaService) {}

  // Fórmula canônica: newStart < existingEnd && newEnd > existingStart
  // Paridade exata com Apps Script e conflict.ts do frontend.
  // tx opcional: quando chamado dentro de $transaction, passa o cliente transacional.
  async hasConflict(params: ConflictParams, tx?: Prisma.TransactionClient): Promise<boolean> {
    const client = (tx ?? this.prisma) as PrismaService;
    const { roomId, date, inicio, fim, excludeId } = params;

    const count = await client.reservation.count({
      where: {
        roomId,
        date,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] },
        deletedAt: null,
        // existingStart < newFim  →  existingStart < fim
        inicio: { lt: fim },
        // existingEnd > newStart  →  existingFim > inicio
        fim: { gt: inicio },
        ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
      },
    });

    return count > 0;
  }
}
