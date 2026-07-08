import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RoomsService } from '../rooms.service';

const mockRoomDelegate = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

const mockPrisma = { room: mockRoomDelegate };

function makeService(): RoomsService {
  return new RoomsService(mockPrisma as unknown as Parameters<typeof RoomsService>[0]);
}

function makePrismaP2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });
}

describe('RoomsService', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── findAll ────────────────────────────────────────────────────────────────
  describe('findAll()', () => {
    it('retorna apenas salas com available=true', async () => {
      const rooms = [{ id: '1', name: '01 Sala', available: true }];
      mockRoomDelegate.findMany.mockResolvedValue(rooms);

      const result = await makeService().findAll();

      expect(mockRoomDelegate.findMany).toHaveBeenCalledWith({
        where: { available: true },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(rooms);
    });
  });

  // ── findAllAdmin ───────────────────────────────────────────────────────────
  describe('findAllAdmin()', () => {
    it('retorna todas as salas sem filtro de available', async () => {
      const rooms = [
        { id: '1', name: '01 Sala', available: true },
        { id: '2', name: '02 Inativa', available: false },
      ];
      mockRoomDelegate.findMany.mockResolvedValue(rooms);

      const result = await makeService().findAllAdmin();

      expect(mockRoomDelegate.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
      expect(result).toHaveLength(2);
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────
  describe('findOne()', () => {
    it('retorna a sala quando encontrada', async () => {
      const room = { id: 'abc', name: '708 Lab. CLP', available: true };
      mockRoomDelegate.findUnique.mockResolvedValue(room);

      await expect(makeService().findOne('abc')).resolves.toEqual(room);
    });

    it('lança NotFoundException quando sala não existe', async () => {
      mockRoomDelegate.findUnique.mockResolvedValue(null);

      await expect(makeService().findOne('nao-existe')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────
  describe('create()', () => {
    it('cria e retorna a sala com sucesso', async () => {
      const dto = { name: 'Nova Sala', type: 'SALA_COMUM' as const };
      const created = { id: 'new-id', ...dto, available: true, capacity: null, floor: null };
      mockRoomDelegate.create.mockResolvedValue(created);

      await expect(makeService().create(dto as never)).resolves.toEqual(created);
      expect(mockRoomDelegate.create).toHaveBeenCalledWith({ data: dto });
    });

    it('lança ConflictException em nome duplicado (P2002)', async () => {
      const dto = { name: '01 Sala', type: 'SALA_COMUM' as const };
      mockRoomDelegate.create.mockRejectedValue(makePrismaP2002());

      await expect(makeService().create(dto as never)).rejects.toThrow(ConflictException);
    });

    it('propaga outros erros sem tratar', async () => {
      const dto = { name: 'X', type: 'SALA_COMUM' as const };
      mockRoomDelegate.create.mockRejectedValue(new Error('conexão perdida'));

      await expect(makeService().create(dto as never)).rejects.toThrow('conexão perdida');
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────
  describe('update()', () => {
    it('atualiza e retorna sala com sucesso', async () => {
      const existing = { id: 'abc', name: '01 Sala', available: true };
      mockRoomDelegate.findUnique.mockResolvedValue(existing);
      mockRoomDelegate.update.mockResolvedValue({ ...existing, name: '01 Sala Editada' });

      const result = await makeService().update('abc', { name: '01 Sala Editada' });
      expect(result.name).toBe('01 Sala Editada');
    });

    it('lança NotFoundException se sala não existe', async () => {
      mockRoomDelegate.findUnique.mockResolvedValue(null);

      await expect(makeService().update('nao-existe', {})).rejects.toThrow(NotFoundException);
    });

    it('lança ConflictException em nome duplicado (P2002)', async () => {
      mockRoomDelegate.findUnique.mockResolvedValue({ id: 'abc' });
      mockRoomDelegate.update.mockRejectedValue(makePrismaP2002());

      await expect(makeService().update('abc', { name: '01 Sala' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ── softDelete ─────────────────────────────────────────────────────────────
  describe('softDelete()', () => {
    it('marca sala como indisponível (available=false)', async () => {
      const room = { id: 'abc', name: '01 Sala', available: true };
      mockRoomDelegate.findUnique.mockResolvedValue(room);
      mockRoomDelegate.update.mockResolvedValue({ ...room, available: false });

      const result = await makeService().softDelete('abc');

      expect(mockRoomDelegate.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: { available: false },
      });
      expect(result.available).toBe(false);
    });

    it('lança NotFoundException se sala não existe', async () => {
      mockRoomDelegate.findUnique.mockResolvedValue(null);

      await expect(makeService().softDelete('nao-existe')).rejects.toThrow(NotFoundException);
    });
  });
});
