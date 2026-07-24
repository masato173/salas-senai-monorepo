import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Role } from '@prisma/client';
import { UsersService } from '../users.service';

const mockRepo = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  findAll: vi.fn(),
  updateById: vi.fn(),
  findAllProfessors: vi.fn(),
};
const mockPrisma = { auditLog: { create: vi.fn() } };

function makeService(): UsersService {
  return new UsersService(mockRepo as never, mockPrisma as never);
}

describe('UsersService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('listProfessors()', () => {
    it('mapeia os professores do repositório pro shape público (sem passwordHash)', async () => {
      const createdAt = new Date('2026-01-10');
      mockRepo.findAllProfessors.mockResolvedValue([
        {
          id: 'p1',
          name: 'Ana Souza',
          email: 'ana@senai.edu',
          passwordHash: 'hash-secreto',
          role: Role.PROFESSOR,
          active: true,
          createdAt,
        },
      ]);

      const result = await makeService().listProfessors();

      expect(mockRepo.findAllProfessors).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        {
          id: 'p1',
          name: 'Ana Souza',
          email: 'ana@senai.edu',
          role: Role.PROFESSOR,
          active: true,
          createdAt,
        },
      ]);
      expect(result[0]).not.toHaveProperty('passwordHash');
    });

    it('retorna array vazio quando não há professores ativos', async () => {
      mockRepo.findAllProfessors.mockResolvedValue([]);

      const result = await makeService().listProfessors();

      expect(result).toEqual([]);
    });
  });
});
