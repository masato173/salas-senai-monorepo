import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Room } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../reservations/audit/audit.service';
import type { CreateRoomDto } from './dtos/create-room.dto';
import type { UpdateRoomDto } from './dtos/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(): Promise<Room[]> {
    return this.prisma.room.findMany({
      where: { available: true },
      orderBy: { name: 'asc' },
    });
  }

  findAllAdmin(): Promise<Room[]> {
    return this.prisma.room.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string): Promise<Room> {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException(`Sala "${id}" não encontrada.`);
    return room;
  }

  async create(dto: CreateRoomDto, currentUserId: string): Promise<Room> {
    return this.prisma.$transaction(async tx => {
      let room: Room;
      try {
        room = await tx.room.create({ data: dto });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException(`Sala com nome "${dto.name}" já existe.`);
        }
        throw e;
      }

      await this.auditService.log(tx, {
        action: 'CREATE_ROOM',
        entityType: 'Room',
        entityId: room.id,
        userId: currentUserId,
        after: room,
      });

      return room;
    });
  }

  async update(id: string, dto: UpdateRoomDto, currentUserId: string): Promise<Room> {
    const before = await this.findOne(id);
    return this.prisma.$transaction(async tx => {
      let room: Room;
      try {
        room = await tx.room.update({ where: { id }, data: dto });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException(`Sala com nome "${String(dto.name)}" já existe.`);
        }
        throw e;
      }

      await this.auditService.log(tx, {
        action: 'UPDATE_ROOM',
        entityType: 'Room',
        entityId: room.id,
        userId: currentUserId,
        before,
        after: room,
      });

      return room;
    });
  }

  async softDelete(id: string, currentUserId: string): Promise<Room> {
    const before = await this.findOne(id);
    return this.prisma.$transaction(async tx => {
      const room = await tx.room.update({
        where: { id },
        data: { available: false },
      });

      await this.auditService.log(tx, {
        action: 'DEACTIVATE_ROOM',
        entityType: 'Room',
        entityId: room.id,
        userId: currentUserId,
        before,
        after: room,
      });

      return room;
    });
  }
}
