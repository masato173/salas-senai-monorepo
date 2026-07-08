import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReservationStatus } from '@prisma/client';
import { ConflictService } from '../conflict.service';

const mockReservationDelegate = {
  count: vi.fn(),
};

const mockPrisma = {
  reservation: mockReservationDelegate,
};

function makeService(): ConflictService {
  return new ConflictService(mockPrisma as never);
}

// Reserva base existente: 08:00–12:00, roomId=r1, date=2026-07-10, PENDING
const BASE = { roomId: 'r1', date: '2026-07-10' };

describe('ConflictService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('hasConflict()', () => {
    // Paridade exata com conflict.test.ts do frontend
    // Fórmula: newStart < existingEnd && newEnd > existingStart

    it('detecta sobreposição total (nova contida na existente)', async () => {
      mockReservationDelegate.count.mockResolvedValue(1);
      const result = await makeService().hasConflict({
        ...BASE,
        inicio: '09:00',
        fim: '11:00',
      });
      expect(result).toBe(true);
    });

    it('detecta sobreposição parcial início (nova começa antes)', async () => {
      mockReservationDelegate.count.mockResolvedValue(1);
      const result = await makeService().hasConflict({
        ...BASE,
        inicio: '07:00',
        fim: '09:00',
      });
      expect(result).toBe(true);
    });

    it('detecta sobreposição parcial fim (nova termina depois)', async () => {
      mockReservationDelegate.count.mockResolvedValue(1);
      const result = await makeService().hasConflict({
        ...BASE,
        inicio: '11:00',
        fim: '14:00',
      });
      expect(result).toBe(true);
    });

    it('NÃO conflita quando adjacentes (fim da nova === início da existente)', async () => {
      mockReservationDelegate.count.mockResolvedValue(0);
      const result = await makeService().hasConflict({
        ...BASE,
        inicio: '06:00',
        fim: '08:00',
      });
      expect(result).toBe(false);
    });

    it('NÃO conflita quando horários completamente separados', async () => {
      mockReservationDelegate.count.mockResolvedValue(0);
      const result = await makeService().hasConflict({
        ...BASE,
        inicio: '13:00',
        fim: '15:00',
      });
      expect(result).toBe(false);
    });

    it('passa WHERE correto para status (apenas PENDING e APPROVED)', async () => {
      mockReservationDelegate.count.mockResolvedValue(0);
      await makeService().hasConflict({ ...BASE, inicio: '09:00', fim: '10:00' });

      const calledWith = mockReservationDelegate.count.mock.calls[0][0] as {
        where: { status: { in: ReservationStatus[] } };
      };
      expect(calledWith.where.status).toEqual({
        in: [ReservationStatus.PENDING, ReservationStatus.APPROVED],
      });
    });

    it('exclui a própria reserva via excludeId', async () => {
      mockReservationDelegate.count.mockResolvedValue(0);
      await makeService().hasConflict({
        ...BASE,
        inicio: '09:00',
        fim: '10:00',
        excludeId: 'self-id',
      });

      const calledWith = mockReservationDelegate.count.mock.calls[0][0] as {
        where: { id?: { not: string } };
      };
      expect(calledWith.where.id).toEqual({ not: 'self-id' });
    });

    it('NÃO inclui id no WHERE quando excludeId não é passado', async () => {
      mockReservationDelegate.count.mockResolvedValue(0);
      await makeService().hasConflict({ ...BASE, inicio: '09:00', fim: '10:00' });

      const calledWith = mockReservationDelegate.count.mock.calls[0][0] as {
        where: { id?: unknown };
      };
      expect(calledWith.where.id).toBeUndefined();
    });

    it('retorna false quando count = 0', async () => {
      mockReservationDelegate.count.mockResolvedValue(0);
      await expect(
        makeService().hasConflict({ ...BASE, inicio: '09:00', fim: '10:00' }),
      ).resolves.toBe(false);
    });
  });
});
