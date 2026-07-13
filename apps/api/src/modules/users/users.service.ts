import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { User, Role } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersRepository } from './users.repository';
import type { FindAllResult } from './users.repository';
import type { UserPublicDto } from './dtos/user-public.dto';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

function toPublicDto(user: User): UserPublicDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
  };
}

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly prisma: PrismaService,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findByEmail(email);
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findById(id);
  }

  async create(data: { name: string; email: string; password: string }): Promise<User> {
    const existing = await this.repo.findByEmail(data.email);
    if (existing) throw new ConflictException('Email já cadastrado.');
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    return this.repo.create({ name: data.name, email: data.email, passwordHash });
  }

  validatePassword(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }

  async listUsers(params: {
    role?: Role;
    search?: string;
    isActive?: boolean;
    page: number;
    limit: number;
  }): Promise<PaginatedResult<UserPublicDto>> {
    const result: FindAllResult = await this.repo.findAll(params);
    return {
      data: result.users.map(toPublicDto),
      total: result.total,
      page: params.page,
      limit: params.limit,
    };
  }

  async updateRole(id: string, role: Role, requester: RequestUser): Promise<UserPublicDto> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`Usuário ${id} não encontrado.`);
    const updated = await this.repo.updateById(id, { role });
    await this.prisma.auditLog.create({
      data: {
        action: 'UPDATE_ROLE',
        entityType: 'User',
        entityId: id,
        userId: requester.userId,
        before: { role: existing.role } as Prisma.InputJsonValue,
        after: { role } as Prisma.InputJsonValue,
      },
    });
    return toPublicDto(updated);
  }

  async setActive(id: string, isActive: boolean, requester: RequestUser): Promise<UserPublicDto> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`Usuário ${id} não encontrado.`);
    const updated = await this.repo.updateById(id, { active: isActive });
    await this.prisma.auditLog.create({
      data: {
        action: 'SET_ACTIVE',
        entityType: 'User',
        entityId: id,
        userId: requester.userId,
        before: { active: existing.active } as Prisma.InputJsonValue,
        after: { active: isActive } as Prisma.InputJsonValue,
      },
    });
    return toPublicDto(updated);
  }
}
