import { Injectable } from '@nestjs/common';
import type { User, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role?: Role;
}

interface FindAllParams {
  role?: Role;
  search?: string;
  isActive?: boolean;
  page: number;
  limit: number;
}

export interface FindAllResult {
  users: User[];
  total: number;
}

interface UpdateUserData {
  role?: Role;
  active?: boolean;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async findAll(params: FindAllParams): Promise<FindAllResult> {
    const { role, search, isActive, page, limit } = params;
    const where = {
      ...(role !== undefined ? { role } : {}),
      ...(isActive !== undefined ? { active: isActive } : {}),
      ...(search !== undefined
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users, total };
  }

  updateById(id: string, data: UpdateUserData): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }
}
