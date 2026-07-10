import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
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
