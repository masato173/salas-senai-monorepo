import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { User } from '@prisma/client';
import { Prisma, Role } from '@prisma/client';
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

  // Lista de professores ativos pra COORDENADOR/ADMIN criarem reserva em
  // nome de alguém (proxy) — sem paginação, o frontend povoa um seletor.
  async listProfessors(): Promise<UserPublicDto[]> {
    const users = await this.repo.findAllProfessors();
    return users.map(toPublicDto);
  }

  async updateRole(id: string, role: Role, requester: RequestUser): Promise<UserPublicDto> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`Usuário ${id} não encontrado.`);

    // Gates de segurança — só se aplicam a COORDENADOR (ADMIN é o nível
    // máximo do sistema, sem restrição adicional). Nunca confiar só no
    // @Roles do controller pra isso: sem isso, COORDENADOR conseguiria se
    // auto-promover a ADMIN ou mexer em outro COORDENADOR/ADMIN via uma
    // interface legítima (Fase B — segurança).
    if (requester.role === 'COORDENADOR') {
      if (role === Role.ADMIN) {
        throw new ForbiddenException('Coordenador não pode promover usuário a ADMIN.');
      }
      if (existing.role === Role.ADMIN) {
        throw new ForbiddenException('Coordenador não pode alterar um usuário ADMIN.');
      }
      if (existing.role === Role.COORDENADOR) {
        throw new ForbiddenException('Coordenador não pode alterar outro COORDENADOR.');
      }
    }

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

    // Mesmos gates de updateRole — COORDENADOR só ativa/desativa PROFESSOR,
    // nunca ADMIN nem outro COORDENADOR (nem a si mesmo). Independe do
    // valor de isActive: a restrição é sobre QUEM pode ser alvo, não sobre
    // a direção da mudança.
    if (requester.role === 'COORDENADOR') {
      if (existing.role === Role.ADMIN) {
        throw new ForbiddenException('Coordenador não pode alterar status de um usuário ADMIN.');
      }
      if (existing.role === Role.COORDENADOR) {
        throw new ForbiddenException('Coordenador não pode alterar status de outro COORDENADOR.');
      }
    }

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
