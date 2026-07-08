import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Room } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRoomDto } from './dtos/create-room.dto';
import type { UpdateRoomDto } from './dtos/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(dto: CreateRoomDto): Promise<Room> {
    try {
      return await this.prisma.room.create({ data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Sala com nome "${dto.name}" já existe.`);
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateRoomDto): Promise<Room> {
    await this.findOne(id);
    try {
      return await this.prisma.room.update({ where: { id }, data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Sala com nome "${String(dto.name)}" já existe.`);
      }
      throw e;
    }
  }

  async softDelete(id: string): Promise<Room> {
    await this.findOne(id);
    return this.prisma.room.update({
      where: { id },
      data: { available: false },
    });
  }
}
