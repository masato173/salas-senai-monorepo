import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException as NestConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import type { Reservation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictService } from './conflict.service';
import { OwnershipService } from './ownership.service';
import { AuditService } from './audit/audit.service';
import type { CreateReservationDto } from './dtos/create-reservation.dto';
import type { UpdateReservationDto } from './dtos/update-reservation.dto';
import type { UpdateReservationGroupDto } from './dtos/update-reservation-group.dto';
import type { UpdateReservationSelectedDto } from './dtos/update-reservation-selected.dto';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { RealtimeService } from '../realtime/realtime.service';
import type { CreateReservationRangeDto } from './dtos/create-reservation-range.dto';

interface FindAllParams {
  roomId?: string | undefined;
  date?: string | undefined;
  status?: ReservationStatus | undefined;
  mine?: boolean | undefined;
  currentUser: RequestUser;
}

@Injectable()
export class ReservationsService {
  // Datas puladas por conflito em createRange não fazem parte do contrato de
  // resposta ({ count, reservations }) — ficam rastreáveis só via log.
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly conflictService: ConflictService,
    private readonly ownershipService: OwnershipService,
    private readonly auditService: AuditService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async findAll(params: FindAllParams): Promise<Reservation[]> {
    const { roomId, date, status, mine, currentUser } = params;

    // PROFESSOR vê apenas suas reservas.
    // COORDENADOR/ADMIN vê tudo, a menos que mine=true.
    const restrictToOwn = currentUser.role === 'PROFESSOR' || mine === true;

    return this.prisma.reservation.findMany({
      where: {
        deletedAt: null,
        ...(restrictToOwn ? { userId: currentUser.userId } : {}),
        ...(roomId !== undefined ? { roomId } : {}),
        ...(date !== undefined ? { date } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      include: {
        room: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ date: 'asc' }, { inicio: 'asc' }],
    });
  }

  async findOne(id: string): Promise<Reservation> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        room: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!reservation || reservation.deletedAt !== null) {
      throw new NotFoundException(`Reserva "${id}" não encontrada.`);
    }

    return reservation;
  }

  async create(dto: CreateReservationDto, currentUser: RequestUser): Promise<Reservation> {
    this.assertValidTimes(dto.inicio, dto.fim);

    const createdRes = await this.prisma.$transaction(async tx => {
      // Advisory lock por (roomId, date): serializa escritas concorrentes
      // na mesma sala+dia, evitando race conditions.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${dto.roomId}), hashtext(${dto.date}))
      `;

      const room = await tx.room.findUnique({ where: { id: dto.roomId } });
      if (!room) {
        throw new NotFoundException(`Sala "${dto.roomId}" não encontrada.`);
      }
      if (!room.available) {
        throw new BadRequestException(`Sala "${room.name}" está desativada.`);
      }

      const conflict = await this.conflictService.hasConflict(
        { roomId: dto.roomId, date: dto.date, inicio: dto.inicio, fim: dto.fim },
        tx,
      );
      if (conflict) {
        throw new NestConflictException('Sala já reservada neste horário.');
      }

      const reservation = await tx.reservation.create({
        data: {
          userId: currentUser.userId,
          roomId: dto.roomId,
          date: dto.date,
          inicio: dto.inicio,
          fim: dto.fim,
          turma: dto.turma ?? null,
          notes: dto.notes ?? null,
          status: ReservationStatus.PENDING,
        },
      });

      await this.auditService.log(tx, {
        action: 'CREATE_RESERVATION',
        entityId: reservation.id,
        userId: currentUser.userId,
        after: reservation,
      });

      return reservation;
    });
    this.realtimeService.reservationCreated(createdRes);
    return createdRes;
  }

  async update(
    id: string,
    dto: UpdateReservationDto,
    currentUser: RequestUser,
  ): Promise<Reservation> {
    const existing = await this.ownershipService.assertCanModify(id, currentUser);

    const resolvedInicio = dto.inicio ?? existing.inicio;
    const resolvedFim = dto.fim ?? existing.fim;
    this.assertValidTimes(resolvedInicio, resolvedFim);

    const resolvedRoomId = dto.roomId ?? existing.roomId;
    const resolvedDate = dto.date ?? existing.date;

    const updatedRes = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${resolvedRoomId}), hashtext(${resolvedDate}))
      `;

      const conflict = await this.conflictService.hasConflict(
        {
          roomId: resolvedRoomId,
          date: resolvedDate,
          inicio: resolvedInicio,
          fim: resolvedFim,
          excludeId: id, // exclui a própria reserva da verificação
        },
        tx,
      );
      if (conflict) {
        throw new NestConflictException('Sala já reservada neste horário.');
      }

      const updated = await tx.reservation.update({
        where: { id },
        data: {
          ...(dto.roomId !== undefined ? { roomId: dto.roomId } : {}),
          ...(dto.date !== undefined ? { date: dto.date } : {}),
          ...(dto.inicio !== undefined ? { inicio: dto.inicio } : {}),
          ...(dto.fim !== undefined ? { fim: dto.fim } : {}),
          ...(dto.turma !== undefined ? { turma: dto.turma } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });

      await this.auditService.log(tx, {
        action: 'UPDATE_RESERVATION',
        entityId: id,
        userId: currentUser.userId,
        before: existing,
        after: updated,
      });

      return updated;
    });
    this.realtimeService.reservationUpdated(updatedRes);
    return updatedRes;
  }

  async cancel(id: string, currentUser: RequestUser): Promise<Reservation> {
    // Buscar incluindo soft-deleted para suportar idempotência de cancel
    const quickLookup = await this.prisma.reservation.findUnique({ where: { id } });
    if (quickLookup?.status === ReservationStatus.CANCELLED) return quickLookup;

    // Reserva ativa — assertCanModify verifica existência e ownership normalmente
    const existing = await this.ownershipService.assertCanModify(id, currentUser);

    const cancelledRes = await this.prisma.$transaction(async tx => {
      const cancelled = await tx.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.CANCELLED,
          deletedAt: new Date(),
        },
      });

      await this.auditService.log(tx, {
        action: 'DELETE_RESERVATION',
        entityId: id,
        userId: currentUser.userId,
        before: existing,
        after: cancelled,
      });

      return cancelled;
    });
    this.realtimeService.reservationCancelled(cancelledRes);
    return cancelledRes;
  }

  async updateStatus(
    id: string,
    status: ReservationStatus,
    currentUser: RequestUser,
  ): Promise<Reservation> {
    const reservation = await this.prisma.reservation.findUnique({ where: { id } });

    if (!reservation || reservation.deletedAt !== null) {
      throw new NotFoundException(`Reserva "${id}" não encontrada.`);
    }

    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new BadRequestException('Não é possível alterar o status de uma reserva cancelada.');
    }

    const action =
      status === ReservationStatus.APPROVED
        ? ('APPROVE_RESERVATION' as const)
        : ('REJECT_RESERVATION' as const);

    const statusRes = await this.prisma.$transaction(async tx => {
      const updated = await tx.reservation.update({
        where: { id },
        data: { status },
      });

      await this.auditService.log(tx, {
        action,
        entityId: id,
        userId: currentUser.userId,
        before: reservation,
        after: updated,
      });

      return updated;
    });
    if (status === ReservationStatus.APPROVED) {
      this.realtimeService.reservationApproved(statusRes);
    } else {
      this.realtimeService.reservationRejected(statusRes);
    }
    return statusRes;
  }

  async updateGroup(
    dto: UpdateReservationGroupDto,
    currentUser: RequestUser,
  ): Promise<{ count: number; reservations: Reservation[] }> {
    const reservations = await this.prisma.reservation.findMany({
      where: { groupId: dto.groupId, deletedAt: null },
    });
    if (reservations.length === 0) {
      throw new NotFoundException(`Nenhuma reserva encontrada para o grupo "${dto.groupId}".`);
    }
    // Verifica permissão na primeira reserva do grupo
    await this.ownershipService.assertCanModify(reservations[0].id, currentUser);
    const updated: Reservation[] = [];
    for (const r of reservations) {
      const resolvedRoomId = dto.roomId ?? r.roomId;
      const resolvedInicio = dto.inicio ?? r.inicio;
      const resolvedFim = dto.fim ?? r.fim;
      if (dto.inicio !== undefined || dto.fim !== undefined) {
        this.assertValidTimes(resolvedInicio, resolvedFim);
      }
      const conflict = await this.conflictService.hasConflict({
        roomId: resolvedRoomId,
        date: r.date,
        inicio: resolvedInicio,
        fim: resolvedFim,
        excludeId: r.id,
      });
      if (conflict) continue; // pula datas com conflito — não aborta o grupo todo
      const u = await this.prisma.reservation.update({
        where: { id: r.id },
        data: {
          ...(dto.roomId !== undefined ? { roomId: dto.roomId } : {}),
          ...(dto.inicio !== undefined ? { inicio: dto.inicio } : {}),
          ...(dto.fim !== undefined ? { fim: dto.fim } : {}),
          ...(dto.turma !== undefined ? { turma: dto.turma } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });
      updated.push(u);
    }
    return { count: updated.length, reservations: updated };
  }

  async updateSelected(
    dto: UpdateReservationSelectedDto,
    currentUser: RequestUser,
  ): Promise<{ count: number; reservations: Reservation[] }> {
    const updated: Reservation[] = [];
    for (const id of dto.ids) {
      const r = await this.ownershipService.assertCanModify(id, currentUser);
      const resolvedRoomId = dto.roomId ?? r.roomId;
      const resolvedInicio = dto.inicio ?? r.inicio;
      const resolvedFim = dto.fim ?? r.fim;
      if (dto.inicio !== undefined || dto.fim !== undefined) {
        this.assertValidTimes(resolvedInicio, resolvedFim);
      }
      const conflict = await this.conflictService.hasConflict({
        roomId: resolvedRoomId,
        date: r.date,
        inicio: resolvedInicio,
        fim: resolvedFim,
        excludeId: id,
      });
      if (conflict) continue;
      const u = await this.prisma.reservation.update({
        where: { id },
        data: {
          ...(dto.roomId !== undefined ? { roomId: dto.roomId } : {}),
          ...(dto.inicio !== undefined ? { inicio: dto.inicio } : {}),
          ...(dto.fim !== undefined ? { fim: dto.fim } : {}),
          ...(dto.turma !== undefined ? { turma: dto.turma } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });
      updated.push(u);
    }
    return { count: updated.length, reservations: updated };
  }

  private assertValidTimes(inicio: string, fim: string): void {
    if (inicio >= fim) {
      throw new BadRequestException('O horário de início deve ser anterior ao horário de fim.');
    }
    if (inicio < '06:00') {
      throw new BadRequestException('Reservas não são permitidas antes das 06:00.');
    }
    if (fim > '23:00') {
      throw new BadRequestException('Reservas não são permitidas após as 23:00.');
    }
  }
  async createRange(
    dto: CreateReservationRangeDto,
    currentUser: RequestUser,
  ): Promise<{ count: number; reservations: Reservation[] }> {
    const datas = this.expandirDatas(dto.dateInicio, dto.dateFim, dto.diasSemana);

    if (datas.length === 0) {
      throw new BadRequestException('Nenhuma data válida encontrada no intervalo especificado.');
    }

    if (datas.length > 60) {
      throw new BadRequestException('Máximo de 60 dias consecutivos.');
    }

    const groupId = crypto.randomUUID();
    const reservations: Reservation[] = [];
    const skipped: Array<{ date: string; reason: string }> = [];

    for (const data of datas) {
      // Uma $transaction por data — NÃO uma única para o range inteiro:
      // pgbouncer em transaction mode não suporta transactions longas
      // (mesmo padrão de create()/update(), ver Bug histórico #2).
      const reservation = await this.prisma.$transaction(async tx => {
        // Advisory lock por (roomId, date): serializa escritas concorrentes
        // na mesma sala+dia, evitando race conditions.
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${dto.roomId}), hashtext(${data}))
        `;

        const conflict = await this.conflictService.hasConflict(
          { roomId: dto.roomId, date: data, inicio: dto.inicio, fim: dto.fim },
          tx,
        );
        if (conflict) {
          return null;
        }

        const created = await tx.reservation.create({
          data: {
            userId: currentUser.userId,
            roomId: dto.roomId,
            groupId,
            date: data,
            inicio: dto.inicio,
            fim: dto.fim,
            turma: dto.turma ?? null,
            notes: dto.notes ?? null,
            status: ReservationStatus.PENDING,
          },
        });

        await this.auditService.log(tx, {
          action: 'CREATE_RESERVATION',
          entityId: created.id,
          userId: currentUser.userId,
          after: created,
        });

        return created;
      });

      if (reservation === null) {
        skipped.push({ date: data, reason: 'conflito' });
        continue;
      }
      reservations.push(reservation);
    }

    if (skipped.length > 0) {
      this.logger.warn(
        `createRange: ${skipped.length} data(s) pulada(s) por conflito — ` +
          `roomId=${dto.roomId} datas=${skipped.map(s => s.date).join(',')}`,
      );
    }

    for (const reservation of reservations) {
      this.realtimeService.reservationCreated(reservation);
    }

    return { count: reservations.length, reservations };
  }

  private expandirDatas(dateinicio: string, dateFim: string, diasSemana: number[]): string[] {
    const dates: string[] = [];
    const atual = new Date(dateinicio + 'T12:00:00Z');
    const fim = new Date(dateFim + 'T12:00:00Z');

    while (atual <= fim) {
      if (diasSemana.includes(atual.getUTCDay())) {
        dates.push(atual.toISOString().slice(0, 10));
      }
      atual.setUTCDate(atual.getUTCDate() + 1);
    }
    return dates;
  }
}
