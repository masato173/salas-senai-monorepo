import { Injectable } from '@nestjs/common';
import type { AuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface FindAuditParams {
  entityType?: string | undefined;
  entityId?: string | undefined;
  userId?: string | undefined;
  action?: string | undefined;
  from?: string | undefined; // YYYY-MM-DD
  to?: string | undefined; // YYYY-MM-DD
  page?: number | undefined;
  limit?: number | undefined;
}

export interface AuditListResult {
  data: (AuditLog & { user: { id: string; name: string; email: string } })[];
  total: number;
  page: number;
  limit: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: FindAuditParams): Promise<AuditListResult> {
    const { entityType, entityId, userId, action, from, to } = params;

    const page = Math.max(1, params.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));

    const where: Prisma.AuditLogWhereInput = {
      ...(entityType !== undefined ? { entityType } : {}),
      ...(entityId !== undefined ? { entityId } : {}),
      ...(userId !== undefined ? { userId } : {}),
      ...(action !== undefined ? { action } : {}),
      ...(from !== undefined || to !== undefined
        ? {
            timestamp: {
              ...(from !== undefined ? { gte: new Date(from) } : {}),
              ...(to !== undefined ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data: data as AuditListResult['data'], total, page, limit };
  }
}
