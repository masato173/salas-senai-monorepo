import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeApproveReservation } from '../useApproveReservation';
import type {
  BackendEnvelope,
  CreatedReservationRow,
  BackendErrorCode,
} from '../../services/appsScript';

const mockService = { updateStatus: vi.fn() };

const APPROVED_ROW: CreatedReservationRow = {
  id: 'res-1',
  sala: '603 Sala',
  data: '2027-03-15',
  inicio: '09:00',
  fim: '11:00',
  professor: 'Prof. Ana Souza',
  turma: '',
  observacao: '',
  status: 'APPROVED',
  createdBy: 'ana@senai.edu',
  createdAt: '2027-03-10T10:00:00.000Z',
  updatedAt: '2027-03-10T10:00:00.000Z',
};

const OK_RES: BackendEnvelope<CreatedReservationRow> = {
  ok: true,
  data: APPROVED_ROW,
  error: null,
};

function errRes(code: BackendErrorCode): BackendEnvelope<CreatedReservationRow> {
  return { ok: false, data: null, error: { code, message: `erro ${code}` } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('executeApproveReservation()', () => {
  it('chama updateStatus com APPROVED e retorna ok=true', async () => {
    mockService.updateStatus.mockResolvedValue(OK_RES);
    const res = await executeApproveReservation(mockService, 'res-1');
    expect(mockService.updateStatus).toHaveBeenCalledWith('res-1', 'APPROVED');
    expect(res.ok).toBe(true);
    expect(res.data?.status).toBe('APPROVED');
  });

  it('retorna FORBIDDEN quando usuário não tem permissão', async () => {
    mockService.updateStatus.mockResolvedValue(errRes('FORBIDDEN'));
    const res = await executeApproveReservation(mockService, 'res-1');
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('FORBIDDEN');
  });

  it('retorna NOT_FOUND quando reserva não existe', async () => {
    mockService.updateStatus.mockResolvedValue(errRes('NOT_FOUND'));
    const res = await executeApproveReservation(mockService, 'res-1');
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('NOT_FOUND');
  });

  it('converte erro de rede em envelope INTERNAL', async () => {
    mockService.updateStatus.mockRejectedValue(new Error('timeout'));
    const res = await executeApproveReservation(mockService, 'res-1');
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INTERNAL');
    expect(res.error?.message).toBe('timeout');
  });
});
