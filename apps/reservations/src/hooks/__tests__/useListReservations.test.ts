import { describe, it, expect, vi, afterEach } from 'vitest';
import { executeListReservations } from '../useListReservations';
import type { ListReservationsResponse, BackendErrorCode } from '../../services/apiTypes';

const OK_RES: ListReservationsResponse = {
  ok: true,
  data: {
    count: 1,
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
    ],
  },
  error: null,
};

function envelope(code: BackendErrorCode): ListReservationsResponse {
  return { ok: false, data: null, error: { code, message: `erro ${code}` } };
}

describe('executeListReservations()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('chama service uma vez em caso de sucesso', async () => {
    const listReservations = vi.fn().mockResolvedValue(OK_RES);
    const result = await executeListReservations({ listReservations });

    expect(listReservations).toHaveBeenCalledTimes(1);
    expect(result).toEqual(OK_RES);
  });

  it('NÃO retenta em NOT_FOUND', async () => {
    const listReservations = vi.fn().mockResolvedValue(envelope('NOT_FOUND'));
    await executeListReservations({ listReservations });
    expect(listReservations).toHaveBeenCalledTimes(1);
  });

  it('retenta em INTERNAL e retorna sucesso eventual', async () => {
    const listReservations = vi
      .fn()
      .mockResolvedValueOnce(envelope('INTERNAL'))
      .mockResolvedValueOnce(OK_RES);

    const result = await executeListReservations({ listReservations }, undefined, {
      maxRetries: 2,
    });

    expect(listReservations).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it('retenta em falha de rede e retorna sucesso eventual', async () => {
    const listReservations = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Network down'))
      .mockResolvedValueOnce(OK_RES);

    const result = await executeListReservations({ listReservations }, undefined, {
      maxRetries: 2,
    });

    expect(listReservations).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it('após esgotar retries em INTERNAL, devolve o último envelope ok=false', async () => {
    const listReservations = vi.fn().mockResolvedValue(envelope('INTERNAL'));

    const result = await executeListReservations({ listReservations }, undefined, {
      maxRetries: 2,
    });

    expect(listReservations).toHaveBeenCalledTimes(3); // 1 inicial + 2 retries
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INTERNAL');
  });

  it('após esgotar retries em falha de rede, lança o erro', async () => {
    const listReservations = vi.fn().mockRejectedValue(new TypeError('Network down'));

    await expect(
      executeListReservations({ listReservations }, undefined, { maxRetries: 1 }),
    ).rejects.toThrow('Network down');
    expect(listReservations).toHaveBeenCalledTimes(2);
  });

  it('encaminha options.includeCancelled para o service', async () => {
    const listReservations = vi.fn().mockResolvedValue(OK_RES);

    await executeListReservations({ listReservations }, { includeCancelled: true });

    expect(listReservations).toHaveBeenCalledWith({ includeCancelled: true });
  });
});
