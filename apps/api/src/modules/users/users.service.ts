import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { User } from '@prisma/client';
import { UsersRepository } from './users.repository';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

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
}
