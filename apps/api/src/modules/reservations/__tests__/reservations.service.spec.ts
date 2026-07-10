import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import { ReservationsService } from '../reservations.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockTx = {
  $executeRaw: vi.fn().mockResolvedValue(undefined), // advisory lock
  room: { findUnique: vi.fn() },
  reservation: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
};

const mockPrisma = {
  reservation: { findMany: vi.fn(), findUnique: vi.fn() },
  $transaction: vi
    .fn()
    .mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};

const mockConflictService = { hasConflict: vi.fn() };
const mockOwnershipService = { assertCanModify: vi.fn() };
const mockAuditService = { log: vi.fn() };
const mockRealtimeService = {
  reservationCreated: vi.fn(),
  reservationUpdated: vi.fn(),
  reservationCancelled: vi.fn(),
  reservationApproved: vi.fn(),
  reservationRejected: vi.fn(),
};

function makeService(): ReservationsService {
  return new ReservationsService(
    mockPrisma as never,
    mockConflictService as never,
    mockOwnershipService as never,
    mockAuditService as never,
    mockRealtimeService as never,
  );
}

const adminUser = { userId: 'admin-1', email: 'admin@senai.edu', role: 'ADMIN' };
const profUser = { userId: 'prof-1', email: 'prof@senai.edu', role: 'PROFESSOR' };

const baseReservation = {
  id: 'res-1',
  userId: 'prof-1',
  roomId: 'room-1',
  date: '2026-07-10',
  inicio: '08:00',
  fim: '10:00',
  status: ReservationStatus.PENDING,
  notes: null,
  deletedAt: null,
  groupId: null,
  clientRequestId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReservationsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditService.log.mockResolvedValue(undefined);
  });

  // ── create ────────────────────────────────────────────────────────────────
  describe('create()', () => {
    const dto = { roomId: 'room-1', date: '2026-07-10', inicio: '08:00', fim: '10:00' };

    beforeEach(() => {
      mockTx.room.findUnique.mockResolvedValue({ id: 'room-1', name: '01 Sala', available: true });
      mockConflictService.hasConflict.mockResolvedValue(false);
      mockTx.reservation.create.mockResolvedValue(baseReservation);
    });

    it('cria reserva com sucesso e retorna a reserva criada', async () => {
      const result = await makeService().create(dto, profUser);
      expect(result).toEqual(baseReservation);
      expect(mockTx.$executeRaw).toHaveBeenCalled(); // advisory lock executado
      expect(mockAuditService.log).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ action: 'CREATE_RESERVATION', userId: profUser.userId }),
      );
    });

    it('lança ConflictException quando há conflito de horário', async () => {
      mockConflictService.hasConflict.mockResolvedValue(true);
      await expect(makeService().create(dto, profUser)).rejects.toThrow(ConflictException);
    });

    it('lança NotFoundException quando sala não existe', async () => {
      mockTx.room.findUnique.mockResolvedValue(null);
      await expect(makeService().create(dto, profUser)).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException quando sala está desativada', async () => {
      mockTx.room.findUnique.mockResolvedValue({ id: 'room-1', name: '01 Sala', available: false });
      await expect(makeService().create(dto, profUser)).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException quando inicio >= fim', async () => {
      await expect(
        makeService().create({ ...dto, inicio: '10:00', fim: '08:00' }, profUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException quando inicio antes de 06:00', async () => {
      await expect(makeService().create({ ...dto, inicio: '05:00' }, profUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lança BadRequestException quando fim após 23:00', async () => {
      await expect(makeService().create({ ...dto, fim: '23:30' }, profUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────
  describe('update()', () => {
    beforeEach(() => {
      mockOwnershipService.assertCanModify.mockResolvedValue(baseReservation);
      mockConflictService.hasConflict.mockResolvedValue(false);
      mockTx.reservation.update.mockResolvedValue({ ...baseReservation, fim: '11:00' });
    });

    it('atualiza reserva com sucesso e registra audit log', async () => {
      const result = await makeService().update('res-1', { fim: '11:00' }, adminUser);
      expect(result.fim).toBe('11:00');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ action: 'UPDATE_RESERVATION' }),
      );
    });

    it('lança ConflictException quando novo horário conflita', async () => {
      mockConflictService.hasConflict.mockResolvedValue(true);
      await expect(makeService().update('res-1', { inicio: '09:00' }, adminUser)).rejects.toThrow(
        ConflictException,
      );
    });

    it('lança ForbiddenException para usuário sem permissão', async () => {
      mockOwnershipService.assertCanModify.mockRejectedValue(
        new ForbiddenException('Sem permissão.'),
      );
      await expect(makeService().update('res-1', { fim: '11:00' }, profUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── cancel ────────────────────────────────────────────────────────────────
  describe('cancel()', () => {
    beforeEach(() => {
      mockOwnershipService.assertCanModify.mockResolvedValue(baseReservation);
      // reset: quickLookup retorna PENDING por padrão — idempotência sobreescreve para CANCELLED
      mockPrisma.reservation.findUnique.mockResolvedValue(baseReservation);
      mockTx.reservation.update.mockResolvedValue({
        ...baseReservation,
        status: ReservationStatus.CANCELLED,
        deletedAt: new Date(),
      });
    });

    it('cancela reserva com sucesso', async () => {
      const result = await makeService().cancel('res-1', adminUser);
      expect(result.status).toBe(ReservationStatus.CANCELLED);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ action: 'DELETE_RESERVATION' }),
      );
    });

    it('retorna reserva já cancelada sem erro (idempotência)', async () => {
      const cancelled = { ...baseReservation, status: ReservationStatus.CANCELLED };
      mockOwnershipService.assertCanModify.mockResolvedValue(cancelled);
      // quickLookup (findUnique direto) roda ANTES de assertCanModify no cancel()
      mockPrisma.reservation.findUnique.mockResolvedValue(cancelled);
      const result = await makeService().cancel('res-1', adminUser);
      expect(result.status).toBe(ReservationStatus.CANCELLED);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled(); // não abre tx desnecessária
    });

    it('lança ForbiddenException para usuário sem permissão', async () => {
      mockOwnershipService.assertCanModify.mockRejectedValue(
        new ForbiddenException('Sem permissão.'),
      );
      await expect(makeService().cancel('res-1', profUser)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────
  describe('findAll()', () => {
    beforeEach(() => {
      mockPrisma.reservation.findMany.mockResolvedValue([baseReservation]);
    });

    it('PROFESSOR vê apenas suas próprias reservas', async () => {
      await makeService().findAll({ currentUser: profUser });
      const calledWith = mockPrisma.reservation.findMany.mock.calls[0][0] as {
        where: { userId?: string };
      };
      expect(calledWith.where.userId).toBe(profUser.userId);
    });

    it('ADMIN vê todas as reservas sem filtro de userId', async () => {
      await makeService().findAll({ currentUser: adminUser });
      const calledWith = mockPrisma.reservation.findMany.mock.calls[0][0] as {
        where: { userId?: string };
      };
      expect(calledWith.where.userId).toBeUndefined();
    });

    it('mine=true filtra por userId mesmo para ADMIN', async () => {
      await makeService().findAll({ currentUser: adminUser, mine: true });
      const calledWith = mockPrisma.reservation.findMany.mock.calls[0][0] as {
        where: { userId?: string };
      };
      expect(calledWith.where.userId).toBe(adminUser.userId);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────
  describe('findOne()', () => {
    it('lança NotFoundException quando reserva não existe', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(null);
      await expect(makeService().findOne('nao-existe')).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando reserva está soft-deleted', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        ...baseReservation,
        deletedAt: new Date(),
      });
      await expect(makeService().findOne('res-1')).rejects.toThrow(NotFoundException);
    });
  });
});
