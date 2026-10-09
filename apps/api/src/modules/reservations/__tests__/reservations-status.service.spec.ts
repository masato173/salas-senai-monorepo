import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import { ReservationsService } from '../reservations.service';

// Mocks idênticos ao reservations.service.spec.ts
const mockTx = {
  $executeRaw: vi.fn().mockResolvedValue(undefined),
  room: { findUnique: vi.fn() },
  reservation: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
};

const mockPrisma = {
  reservation: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
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

const coordUser = { userId: 'coord-1', email: 'coord@senai.edu', role: 'COORDENADOR' };

const pendingReservation = {
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

describe('ReservationsService.updateStatus()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditService.log.mockResolvedValue(undefined);
  });

  it('aprova reserva PENDING e registra APPROVE_RESERVATION no audit', async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue(pendingReservation);
    mockTx.reservation.update.mockResolvedValue({
      ...pendingReservation,
      status: ReservationStatus.APPROVED,
    });

    const result = await makeService().updateStatus('res-1', ReservationStatus.APPROVED, coordUser);

    expect(result.status).toBe(ReservationStatus.APPROVED);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ action: 'APPROVE_RESERVATION' }),
    );
  });

  it('rejeita reserva PENDING e registra REJECT_RESERVATION no audit', async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue(pendingReservation);
    mockTx.reservation.update.mockResolvedValue({
      ...pendingReservation,
      status: ReservationStatus.REJECTED,
    });

    const result = await makeService().updateStatus('res-1', ReservationStatus.REJECTED, coordUser);

    expect(result.status).toBe(ReservationStatus.REJECTED);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ action: 'REJECT_RESERVATION' }),
    );
  });

  it('lança BadRequestException se reserva estiver CANCELLED', async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue({
      ...pendingReservation,
      status: ReservationStatus.CANCELLED,
    });

    await expect(
      makeService().updateStatus('res-1', ReservationStatus.APPROVED, coordUser),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando reserva não existe', async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue(null);

    await expect(
      makeService().updateStatus('nao-existe', ReservationStatus.APPROVED, coordUser),
    ).rejects.toThrow(NotFoundException);
  });
});

// #23 — REJECTED não bloqueia horário (ConflictService só conta PENDING/APPROVED).
// Reaprovar uma reserva rejeitada volta a bloquear: checa conflito dentro do
// lock (sala, data), excluindo a própria reserva, como create/update.
describe('ReservationsService.updateStatus() — reaprovação checa conflito (#23)', () => {
  const rejected = { ...pendingReservation, status: ReservationStatus.REJECTED };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditService.log.mockResolvedValue(undefined);
    mockConflictService.hasConflict.mockReset().mockResolvedValue(false);
    mockTx.reservation.findUnique.mockReset().mockResolvedValue(rejected);
    mockPrisma.reservation.findUnique.mockResolvedValue(rejected);
    mockTx.reservation.update.mockResolvedValue({
      ...rejected,
      status: ReservationStatus.APPROVED,
    });
  });

  function firstOrder(fn: { mock: { invocationCallOrder: number[] } }): number {
    return Math.min(...fn.mock.invocationCallOrder);
  }

  it('REJECTED → APPROVED com horário ocupado → 409 e status inalterado', async () => {
    mockConflictService.hasConflict.mockResolvedValue(true);

    const err = await makeService()
      .updateStatus('res-1', ReservationStatus.APPROVED, coordUser)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).message).toBe(
      'Não é possível aprovar: o horário já está ocupado por outra reserva.',
    );
    expect(mockTx.reservation.update).not.toHaveBeenCalled();
    expect(mockAuditService.log).not.toHaveBeenCalled();
  });

  it('REJECTED → APPROVED com horário livre → aprova; lock (sala, data) antes da checagem, no client da tx, excluindo a própria', async () => {
    const result = await makeService().updateStatus('res-1', ReservationStatus.APPROVED, coordUser);

    expect(result.status).toBe(ReservationStatus.APPROVED);
    const lock = mockTx.$executeRaw.mock.calls[0] as unknown[];
    expect([lock[1], lock[2]]).toEqual(['room-1', '2026-07-10']);
    expect(firstOrder(mockTx.$executeRaw)).toBeLessThan(
      firstOrder(mockConflictService.hasConflict),
    );
    expect(mockConflictService.hasConflict).toHaveBeenCalledWith(
      { roomId: 'room-1', date: '2026-07-10', inicio: '08:00', fim: '10:00', excludeId: 'res-1' },
      mockTx,
    );
    expect(firstOrder(mockConflictService.hasConflict)).toBeLessThan(
      firstOrder(mockTx.reservation.update),
    );
  });

  it('PENDING → APPROVED → sem lock nem checagem extra (PENDING já bloqueia; comportamento mantido)', async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue(pendingReservation);

    await makeService().updateStatus('res-1', ReservationStatus.APPROVED, coordUser);

    expect(mockTx.$executeRaw).not.toHaveBeenCalled();
    expect(mockConflictService.hasConflict).not.toHaveBeenCalled();
  });

  it.each([ReservationStatus.PENDING, ReservationStatus.APPROVED, ReservationStatus.REJECTED])(
    '%s → REJECTED → sem checagem (rejeitar libera horário)',
    async from => {
      mockPrisma.reservation.findUnique.mockResolvedValue({ ...pendingReservation, status: from });

      await makeService().updateStatus('res-1', ReservationStatus.REJECTED, coordUser);

      expect(mockConflictService.hasConflict).not.toHaveBeenCalled();
    },
  );

  it('cancelada entre a leitura e o lock → 404, nada gravado', async () => {
    mockTx.reservation.findUnique.mockResolvedValue({ ...rejected, deletedAt: new Date() });

    await expect(
      makeService().updateStatus('res-1', ReservationStatus.APPROVED, coordUser),
    ).rejects.toThrow(NotFoundException);
    expect(mockTx.reservation.update).not.toHaveBeenCalled();
  });

  it('mudou de sala/data entre a leitura e o lock → 409 (recarregar), nada gravado', async () => {
    mockTx.reservation.findUnique.mockResolvedValue({ ...rejected, date: '2026-07-11' });

    await expect(
      makeService().updateStatus('res-1', ReservationStatus.APPROVED, coordUser),
    ).rejects.toThrow(ConflictException);
    expect(mockConflictService.hasConflict).not.toHaveBeenCalled();
    expect(mockTx.reservation.update).not.toHaveBeenCalled();
  });

  it('audit da reaprovação usa o estado relido dentro do lock como "antes"', async () => {
    await makeService().updateStatus('res-1', ReservationStatus.APPROVED, coordUser);

    expect(mockAuditService.log).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ action: 'APPROVE_RESERVATION', before: rejected }),
    );
  });
});
