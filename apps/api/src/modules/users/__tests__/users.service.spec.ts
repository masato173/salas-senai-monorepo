import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
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

function makeUser(overrides: { role?: Role; active?: boolean }) {
  return {
    id: 'u1',
    name: 'Usuário Teste',
    email: 'user@senai.edu',
    passwordHash: 'hash-secreto',
    role: overrides.role ?? Role.PROFESSOR,
    active: overrides.active ?? true,
    createdAt: new Date('2026-01-01'),
  };
}

// requester.role é string (RequestUser vem do JWT, não do enum Role do
// Prisma) — mesmo padrão de reservations.service.ts (currentUser.role
// comparado por literal, não por Role.X).
const requesterCoord = { userId: 'coord-1', email: 'coord@senai.edu', role: 'COORDENADOR' };
const requesterAdmin = { userId: 'admin-1', email: 'admin@senai.edu', role: 'ADMIN' };

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

  describe('updateRole() — gates de segurança pra requester COORDENADOR', () => {
    it('COORDENADOR tentando promover um PROFESSOR a ADMIN → ForbiddenException', async () => {
      mockRepo.findById.mockResolvedValue(makeUser({ role: Role.PROFESSOR }));

      await expect(makeService().updateRole('u1', Role.ADMIN, requesterCoord)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockRepo.updateById).not.toHaveBeenCalled();
    });

    it('COORDENADOR tentando alterar um usuário que já é ADMIN → ForbiddenException', async () => {
      mockRepo.findById.mockResolvedValue(makeUser({ role: Role.ADMIN }));

      await expect(
        makeService().updateRole('u1', Role.COORDENADOR, requesterCoord),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepo.updateById).not.toHaveBeenCalled();
    });

    it('COORDENADOR tentando alterar outro COORDENADOR → ForbiddenException', async () => {
      mockRepo.findById.mockResolvedValue(makeUser({ role: Role.COORDENADOR }));

      await expect(makeService().updateRole('u1', Role.PROFESSOR, requesterCoord)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockRepo.updateById).not.toHaveBeenCalled();
    });

    it('COORDENADOR alterando um PROFESSOR para COORDENADOR → sucesso (permitido)', async () => {
      const existing = makeUser({ role: Role.PROFESSOR });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.updateById.mockResolvedValue({ ...existing, role: Role.COORDENADOR });

      const result = await makeService().updateRole('u1', Role.COORDENADOR, requesterCoord);

      expect(result.role).toBe(Role.COORDENADOR);
      expect(mockRepo.updateById).toHaveBeenCalledWith('u1', { role: Role.COORDENADOR });
    });

    it('requester ADMIN não sofre nenhuma restrição adicional (comportamento preservado)', async () => {
      const existing = makeUser({ role: Role.COORDENADOR });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.updateById.mockResolvedValue({ ...existing, role: Role.ADMIN });

      const result = await makeService().updateRole('u1', Role.ADMIN, requesterAdmin);

      expect(result.role).toBe(Role.ADMIN);
      expect(mockRepo.updateById).toHaveBeenCalledWith('u1', { role: Role.ADMIN });
    });
  });

  describe('setActive() — gates de segurança pra requester COORDENADOR', () => {
    it('COORDENADOR tentando desativar um ADMIN → ForbiddenException', async () => {
      mockRepo.findById.mockResolvedValue(makeUser({ role: Role.ADMIN }));

      await expect(makeService().setActive('u1', false, requesterCoord)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockRepo.updateById).not.toHaveBeenCalled();
    });

    it('COORDENADOR tentando desativar outro COORDENADOR → ForbiddenException', async () => {
      mockRepo.findById.mockResolvedValue(makeUser({ role: Role.COORDENADOR }));

      await expect(makeService().setActive('u1', false, requesterCoord)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockRepo.updateById).not.toHaveBeenCalled();
    });

    it('COORDENADOR desativando um PROFESSOR → sucesso (permitido)', async () => {
      const existing = makeUser({ role: Role.PROFESSOR, active: true });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.updateById.mockResolvedValue({ ...existing, active: false });

      const result = await makeService().setActive('u1', false, requesterCoord);

      expect(result.active).toBe(false);
      expect(mockRepo.updateById).toHaveBeenCalledWith('u1', { active: false });
    });

    it('requester ADMIN desativando um COORDENADOR → sucesso (sem restrição adicional)', async () => {
      const existing = makeUser({ role: Role.COORDENADOR, active: true });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.updateById.mockResolvedValue({ ...existing, active: false });

      const result = await makeService().setActive('u1', false, requesterAdmin);

      expect(result.active).toBe(false);
    });

    // Issue 6 — a restrição é sobre QUEM é o alvo, não sobre a direção da
    // mudança: reativar também é bloqueado.
    it.each([Role.ADMIN, Role.COORDENADOR])(
      'COORDENADOR tentando REATIVAR um %s inativo → ForbiddenException',
      async role => {
        mockRepo.findById.mockResolvedValue(makeUser({ role, active: false }));

        await expect(makeService().setActive('u1', true, requesterCoord)).rejects.toThrow(
          ForbiddenException,
        );
        expect(mockRepo.updateById).not.toHaveBeenCalled();
        expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
      },
    );
  });

  describe('updateRole() — regressão issue 6', () => {
    it('COORDENADOR tentando se rebaixar/alterar a si mesmo (alvo COORDENADOR) → ForbiddenException', async () => {
      mockRepo.findById.mockResolvedValue({
        ...makeUser({ role: Role.COORDENADOR }),
        id: 'coord-1',
      });

      await expect(
        makeService().updateRole('coord-1', Role.PROFESSOR, requesterCoord),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepo.updateById).not.toHaveBeenCalled();
    });

    it('ADMIN alterando outro ADMIN → sucesso (ADMIN não tem gate adicional)', async () => {
      const existing = makeUser({ role: Role.ADMIN });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.updateById.mockResolvedValue({ ...existing, role: Role.COORDENADOR });

      const result = await makeService().updateRole('u1', Role.COORDENADOR, requesterAdmin);

      expect(result.role).toBe(Role.COORDENADOR);
    });

    it('gate barrado não grava auditoria', async () => {
      mockRepo.findById.mockResolvedValue(makeUser({ role: Role.PROFESSOR }));

      await expect(makeService().updateRole('u1', Role.ADMIN, requesterCoord)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });
  });
});
