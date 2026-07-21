import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RoomsService } from '../rooms.service';

const mockTx = {
  room: { create: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
};

const mockRoomDelegate = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

const mockPrisma = {
  room: mockRoomDelegate,
  $transaction: vi
    .fn()
    .mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};

const mockAuditService = { log: vi.fn() };

function makeService(): RoomsService {
  return new RoomsService(
    mockPrisma as unknown as Parameters<typeof RoomsService>[0],
    mockAuditService as never,
  );
}

function makePrismaP2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });
}

const currentUserId = 'admin-1';

describe('RoomsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditService.log.mockResolvedValue(undefined);
  });

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
      mockTx.room.create.mockResolvedValue(created);

      await expect(makeService().create(dto as never, currentUserId)).resolves.toEqual(created);
      expect(mockTx.room.create).toHaveBeenCalledWith({ data: dto });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          action: 'CREATE_ROOM',
          entityType: 'Room',
          entityId: created.id,
          userId: currentUserId,
          after: created,
        }),
      );
    });

    it('lança ConflictException em nome duplicado (P2002)', async () => {
      const dto = { name: '01 Sala', type: 'SALA_COMUM' as const };
      mockTx.room.create.mockRejectedValue(makePrismaP2002());

      await expect(makeService().create(dto as never, currentUserId)).rejects.toThrow(
        ConflictException,
      );
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('propaga outros erros sem tratar', async () => {
      const dto = { name: 'X', type: 'SALA_COMUM' as const };
      mockTx.room.create.mockRejectedValue(new Error('conexão perdida'));

      await expect(makeService().create(dto as never, currentUserId)).rejects.toThrow(
        'conexão perdida',
      );
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────
  describe('update()', () => {
    it('atualiza e retorna sala com sucesso', async () => {
      const existing = { id: 'abc', name: '01 Sala', available: true };
      const updated = { ...existing, name: '01 Sala Editada' };
      mockRoomDelegate.findUnique.mockResolvedValue(existing);
      mockTx.room.update.mockResolvedValue(updated);

      const result = await makeService().update('abc', { name: '01 Sala Editada' }, currentUserId);
      expect(result.name).toBe('01 Sala Editada');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          action: 'UPDATE_ROOM',
          entityType: 'Room',
          entityId: updated.id,
          userId: currentUserId,
          before: existing,
          after: updated,
        }),
      );
    });

    it('lança NotFoundException se sala não existe', async () => {
      mockRoomDelegate.findUnique.mockResolvedValue(null);

      await expect(makeService().update('nao-existe', {}, currentUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança ConflictException em nome duplicado (P2002)', async () => {
      mockRoomDelegate.findUnique.mockResolvedValue({ id: 'abc' });
      mockTx.room.update.mockRejectedValue(makePrismaP2002());

      await expect(makeService().update('abc', { name: '01 Sala' }, currentUserId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ── softDelete ─────────────────────────────────────────────────────────────
  describe('softDelete()', () => {
    it('marca sala como indisponível (available=false)', async () => {
      const room = { id: 'abc', name: '01 Sala', available: true };
      const deactivated = { ...room, available: false };
      mockRoomDelegate.findUnique.mockResolvedValue(room);
      mockTx.room.update.mockResolvedValue(deactivated);

      const result = await makeService().softDelete('abc', currentUserId);

      expect(mockTx.room.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: { available: false },
      });
      expect(result.available).toBe(false);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          action: 'DEACTIVATE_ROOM',
          entityType: 'Room',
          entityId: deactivated.id,
          userId: currentUserId,
          before: room,
          after: deactivated,
        }),
      );
    });

    it('lança NotFoundException se sala não existe', async () => {
      mockRoomDelegate.findUnique.mockResolvedValue(null);

      await expect(makeService().softDelete('nao-existe', currentUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
