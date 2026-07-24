import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Role } from '@prisma/client';
import { UsersRepository } from '../users.repository';

const mockUserDelegate = { findMany: vi.fn() };
const mockPrisma = { user: mockUserDelegate };

function makeRepo(): UsersRepository {
  return new UsersRepository(mockPrisma as never);
}

describe('UsersRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('findAllProfessors()', () => {
    it('busca só PROFESSOR ativos e não deletados, ordenado por nome', async () => {
      const professores = [{ id: 'p1', name: 'Ana', role: Role.PROFESSOR, active: true }];
      mockUserDelegate.findMany.mockResolvedValue(professores);

      const result = await makeRepo().findAllProfessors();

      expect(mockUserDelegate.findMany).toHaveBeenCalledWith({
        where: { role: Role.PROFESSOR, active: true, deletedAt: null },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(professores);
    });

    it('não pagina — não passa skip/take pro Prisma', async () => {
      mockUserDelegate.findMany.mockResolvedValue([]);

      await makeRepo().findAllProfessors();

      const calledWith = mockUserDelegate.findMany.mock.calls[0][0] as Record<string, unknown>;
      expect(calledWith.skip).toBeUndefined();
      expect(calledWith.take).toBeUndefined();
    });
  });
});
