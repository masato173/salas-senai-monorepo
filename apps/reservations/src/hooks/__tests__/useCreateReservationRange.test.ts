import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeCreateReservationRange } from '../useCreateReservationRange';
import type {
  CreateReservationRangeRequest,
  CreateReservationRangeResponse,
} from '../../services/apiTypes';

const BASE_REQ: Omit<CreateReservationRangeRequest, 'clientRequestId'> = {
  userEmail: 'professor@senai.edu',
  payload: {
    sala: '603 Sala',
    dataInicio: '2026-12-10',
    dataFim: '2026-12-15',
    diasSemana: [2, 4],
    inicio: '08:00',
    fim: '10:00',
    professor: 'Fulano',
    turma: 'ADS-A',
    observacao: '',
  },
};

const OK_RES: CreateReservationRangeResponse = {
  ok: true,
  data: {
    count: 2,
    reservations: [
      {
        id: 'r-1',
        sala: '603 Sala',
        data: '2026-12-10',
        inicio: '08:00',
        fim: '10:00',
        professor: 'Fulano',
        turma: 'ADS-A',
        observacao: '',
        status: 'ACTIVE',
        createdBy: 'professor@senai.edu',
        createdAt: '2026-06-01T12:00:00.000Z',
        updatedAt: '2026-06-01T12:00:00.000Z',
      },
      {
        id: 'r-2',
        sala: '603 Sala',
        data: '2026-12-15',
        inicio: '08:00',
        fim: '10:00',
        professor: 'Fulano',
        turma: 'ADS-A',
        observacao: '',
        status: 'ACTIVE',
        createdBy: 'professor@senai.edu',
        createdAt: '2026-06-01T12:00:00.000Z',
        updatedAt: '2026-06-01T12:00:00.000Z',
      },
    ],
  },
  error: null,
};

function envelope(
  code: 'CONFLICT' | 'VALIDATION' | 'LOCK_TIMEOUT' | 'DUPLICATE' | 'INTERNAL',
): CreateReservationRangeResponse {
  return { ok: false, data: null, error: { code, message: `erro ${code}` } };
}

describe('executeCreateReservationRange()', () => {
  beforeEach(() => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555',
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('chama service uma vez em caso de sucesso', async () => {
    const createReservationRange = vi.fn().mockResolvedValue(OK_RES);
    const result = await executeCreateReservationRange({ createReservationRange }, BASE_REQ);

    expect(createReservationRange).toHaveBeenCalledTimes(1);
    expect(result).toEqual(OK_RES);
  });

  it('NÃO retenta em CONFLICT', async () => {
    const createReservationRange = vi.fn().mockResolvedValue(envelope('CONFLICT'));
    const result = await executeCreateReservationRange({ createReservationRange }, BASE_REQ);

    expect(createReservationRange).toHaveBeenCalledTimes(1);
    expect(result.error?.code).toBe('CONFLICT');
  });

  it('NÃO retenta em VALIDATION', async () => {
    const createReservationRange = vi.fn().mockResolvedValue(envelope('VALIDATION'));
    await executeCreateReservationRange({ createReservationRange }, BASE_REQ);
    expect(createReservationRange).toHaveBeenCalledTimes(1);
  });

  it('NÃO retenta em DUPLICATE', async () => {
    const createReservationRange = vi.fn().mockResolvedValue(envelope('DUPLICATE'));
    await executeCreateReservationRange({ createReservationRange }, BASE_REQ);
    expect(createReservationRange).toHaveBeenCalledTimes(1);
  });

  it('NÃO retenta em LOCK_TIMEOUT', async () => {
    const createReservationRange = vi.fn().mockResolvedValue(envelope('LOCK_TIMEOUT'));
    await executeCreateReservationRange({ createReservationRange }, BASE_REQ);
    expect(createReservationRange).toHaveBeenCalledTimes(1);
  });

  it('retenta em INTERNAL com o MESMO clientRequestId', async () => {
    const createReservationRange = vi
      .fn()
      .mockResolvedValueOnce(envelope('INTERNAL'))
      .mockResolvedValueOnce(OK_RES);

    const result = await executeCreateReservationRange({ createReservationRange }, BASE_REQ, {
      maxRetries: 2,
    });

    expect(createReservationRange).toHaveBeenCalledTimes(2);
    const firstId = createReservationRange.mock.calls[0][0].clientRequestId;
    const secondId = createReservationRange.mock.calls[1][0].clientRequestId;
    expect(firstId).toBe(secondId);
    expect(firstId).toBe('11111111-2222-3333-4444-555555555555');
    expect(result.ok).toBe(true);
  });

  it('retenta em falha de rede com o MESMO clientRequestId', async () => {
    const createReservationRange = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Network down'))
      .mockResolvedValueOnce(OK_RES);

    const result = await executeCreateReservationRange({ createReservationRange }, BASE_REQ, {
      maxRetries: 2,
    });

    expect(createReservationRange).toHaveBeenCalledTimes(2);
    const firstId = createReservationRange.mock.calls[0][0].clientRequestId;
    const secondId = createReservationRange.mock.calls[1][0].clientRequestId;
    expect(firstId).toBe(secondId);
    expect(result.ok).toBe(true);
  });

  it('após esgotar retries em INTERNAL, devolve o último envelope ok=false', async () => {
    const createReservationRange = vi.fn().mockResolvedValue(envelope('INTERNAL'));

    const result = await executeCreateReservationRange({ createReservationRange }, BASE_REQ, {
      maxRetries: 2,
    });

    expect(createReservationRange).toHaveBeenCalledTimes(3); // 1 inicial + 2 retries
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INTERNAL');
  });

  it('após esgotar retries em falha de rede, lança o erro', async () => {
    const createReservationRange = vi.fn().mockRejectedValue(new TypeError('Network down'));

    await expect(
      executeCreateReservationRange({ createReservationRange }, BASE_REQ, { maxRetries: 1 }),
    ).rejects.toThrow('Network down');
    expect(createReservationRange).toHaveBeenCalledTimes(2);
  });

  it('respeita clientRequestId fornecido externamente', async () => {
    const createReservationRange = vi.fn().mockResolvedValue(OK_RES);

    await executeCreateReservationRange({ createReservationRange }, BASE_REQ, {
      clientRequestId: 'externo-9999',
    });

    expect(createReservationRange.mock.calls[0][0].clientRequestId).toBe('externo-9999');
  });
});
