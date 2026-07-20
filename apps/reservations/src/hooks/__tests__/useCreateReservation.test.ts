import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeCreateReservation } from '../useCreateReservation';
import type { CreateReservationRequest, CreateReservationResponse } from '../../services/apiTypes';

const BASE_REQ: Omit<CreateReservationRequest, 'clientRequestId'> = {
  userEmail: 'professor@senai.edu',
  payload: {
    sala: '603 Sala',
    data: '2026-12-10',
    inicio: '08:00',
    fim: '10:00',
    professor: 'Fulano',
    turma: 'ADS-A',
    observacao: '',
  },
};

const OK_RES: CreateReservationResponse = {
  ok: true,
  data: { id: 'r-1' },
  error: null,
};

function envelope(
  code: 'CONFLICT' | 'VALIDATION' | 'LOCK_TIMEOUT' | 'DUPLICATE' | 'INTERNAL',
): CreateReservationResponse {
  return { ok: false, data: null, error: { code, message: `erro ${code}` } };
}

describe('executeCreateReservation()', () => {
  beforeEach(() => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555',
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('chama service uma vez em caso de sucesso', async () => {
    const createReservation = vi.fn().mockResolvedValue(OK_RES);
    const result = await executeCreateReservation({ createReservation }, BASE_REQ);

    expect(createReservation).toHaveBeenCalledTimes(1);
    expect(result).toEqual(OK_RES);
  });

  it('NÃO retenta em CONFLICT', async () => {
    const createReservation = vi.fn().mockResolvedValue(envelope('CONFLICT'));
    const result = await executeCreateReservation({ createReservation }, BASE_REQ);

    expect(createReservation).toHaveBeenCalledTimes(1);
    expect(result.error?.code).toBe('CONFLICT');
  });

  it('NÃO retenta em VALIDATION', async () => {
    const createReservation = vi.fn().mockResolvedValue(envelope('VALIDATION'));
    await executeCreateReservation({ createReservation }, BASE_REQ);
    expect(createReservation).toHaveBeenCalledTimes(1);
  });

  it('NÃO retenta em DUPLICATE', async () => {
    const createReservation = vi.fn().mockResolvedValue(envelope('DUPLICATE'));
    await executeCreateReservation({ createReservation }, BASE_REQ);
    expect(createReservation).toHaveBeenCalledTimes(1);
  });

  it('retenta em INTERNAL com o MESMO clientRequestId', async () => {
    const createReservation = vi
      .fn()
      .mockResolvedValueOnce(envelope('INTERNAL'))
      .mockResolvedValueOnce(OK_RES);

    const result = await executeCreateReservation({ createReservation }, BASE_REQ, {
      maxRetries: 2,
    });

    expect(createReservation).toHaveBeenCalledTimes(2);
    const firstId = createReservation.mock.calls[0][0].clientRequestId;
    const secondId = createReservation.mock.calls[1][0].clientRequestId;
    expect(firstId).toBe(secondId);
    expect(firstId).toBe('11111111-2222-3333-4444-555555555555');
    expect(result.ok).toBe(true);
  });

  it('retenta em falha de rede com o MESMO clientRequestId', async () => {
    const createReservation = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Network down'))
      .mockResolvedValueOnce(OK_RES);

    const result = await executeCreateReservation({ createReservation }, BASE_REQ, {
      maxRetries: 2,
    });

    expect(createReservation).toHaveBeenCalledTimes(2);
    const firstId = createReservation.mock.calls[0][0].clientRequestId;
    const secondId = createReservation.mock.calls[1][0].clientRequestId;
    expect(firstId).toBe(secondId);
    expect(result.ok).toBe(true);
  });

  it('após esgotar retries em INTERNAL, devolve o último envelope ok=false', async () => {
    const createReservation = vi.fn().mockResolvedValue(envelope('INTERNAL'));

    const result = await executeCreateReservation({ createReservation }, BASE_REQ, {
      maxRetries: 2,
    });

    expect(createReservation).toHaveBeenCalledTimes(3); // 1 inicial + 2 retries
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INTERNAL');
  });

  it('após esgotar retries em falha de rede, lança o erro', async () => {
    const createReservation = vi.fn().mockRejectedValue(new TypeError('Network down'));

    await expect(
      executeCreateReservation({ createReservation }, BASE_REQ, { maxRetries: 1 }),
    ).rejects.toThrow('Network down');
    expect(createReservation).toHaveBeenCalledTimes(2);
  });

  it('respeita clientRequestId fornecido externamente', async () => {
    const createReservation = vi.fn().mockResolvedValue(OK_RES);

    await executeCreateReservation({ createReservation }, BASE_REQ, {
      clientRequestId: 'externo-9999',
    });

    expect(createReservation.mock.calls[0][0].clientRequestId).toBe('externo-9999');
  });
});
