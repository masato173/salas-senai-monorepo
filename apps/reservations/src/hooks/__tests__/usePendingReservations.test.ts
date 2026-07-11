import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeListPendingReservations } from '../usePendingReservations';
import type { ListReservationsResponse } from '../../services/appsScript';

const mockService = { listPendingReservations: vi.fn() };

const PENDING_ROW = {
  id: 'res-1',
  sala: '603 Sala',
  data: '2027-03-15',
  inicio: '09:00',
  fim: '11:00',
  professor: 'Prof. Ana Souza',
  turma: '',
  observacao: '',
  status: 'PENDING',
  createdBy: 'ana@senai.edu',
  createdAt: '2027-03-10T10:00:00.000Z',
  updatedAt: '2027-03-10T10:00:00.000Z',
};

const OK_RES: ListReservationsResponse = {
  ok: true,
  data: { count: 1, reservations: [PENDING_ROW] },
  error: null,
};

const ERR_RES: ListReservationsResponse = {
  ok: false,
  data: null,
  error: { code: 'INTERNAL', message: 'Erro interno.' },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('executeListPendingReservations()', () => {
  it('delega ao service com filtros corretos', async () => {
    mockService.listPendingReservations.mockResolvedValue(OK_RES);
    await executeListPendingReservations(mockService, { status: 'PENDING' });
    expect(mockService.listPendingReservations).toHaveBeenCalledWith({ status: 'PENDING' });
  });

  it('retorna data com reservas quando ok=true', async () => {
    mockService.listPendingReservations.mockResolvedValue(OK_RES);
    const res = await executeListPendingReservations(mockService);
    expect(res.data?.count).toBe(1);
    expect(res.data?.reservations[0]?.status).toBe('PENDING');
  });

  it('retorna envelope de erro quando ok=false', async () => {
    mockService.listPendingReservations.mockResolvedValue(ERR_RES);
    const res = await executeListPendingReservations(mockService);
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INTERNAL');
  });

  it('sem filtros — delega com undefined', async () => {
    mockService.listPendingReservations.mockResolvedValue(OK_RES);
    await executeListPendingReservations(mockService);
    expect(mockService.listPendingReservations).toHaveBeenCalledWith(undefined);
  });

  it('propaga erro de rede se o service lança', async () => {
    mockService.listPendingReservations.mockRejectedValue(new Error('timeout'));
    await expect(executeListPendingReservations(mockService)).rejects.toThrow('timeout');
  });
});
