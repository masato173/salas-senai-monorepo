import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeCancelReservation } from '../useCancelReservation';
import type {
  CancelReservationRequest,
  CancelReservationResponse,
  BackendErrorCode,
} from '../../services/apiTypes';

// CONFLICT e DUPLICATE não são testados aqui intencionalmente:
// cancelReservation não cria reserva, logo esses códigos nunca são retornados.
// Idempotência é state-based (status='CANCELLED'), não por clientRequestId.
// Ver decisão #2 da Etapa 1 backend (Sprint 3).

const BASE_REQ: Omit<CancelReservationRequest, 'clientRequestId'> = {
  userEmail: 'professor@senai.edu',
  payload: { id: 'r-1' },
};

const OK_RES: CancelReservationResponse = {
  ok: true,
  data: {
    id: 'r-1',
    sala: '603 Sala',
    data: '2026-12-10',
    inicio: '08:00',
    fim: '10:00',
    professor: 'Fulano',
    turma: 'ADS-A',
    observacao: '',
    status: 'CANCELLED',
    createdBy: 'professor@senai.edu',
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-10T10:00:00.000Z',
  },
  error: null,
};

function envelope(code: BackendErrorCode): CancelReservationResponse {
  return { ok: false, data: null, error: { code, message: `erro ${code}` } };
}

describe('executeCancelReservation()', () => {
  beforeEach(() => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555',
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('chama service uma vez em caso de sucesso', async () => {
    const cancelReservation = vi.fn().mockResolvedValue(OK_RES);
    const result = await executeCancelReservation({ cancelReservation }, BASE_REQ);

    expect(cancelReservation).toHaveBeenCalledTimes(1);
    expect(result).toEqual(OK_RES);
  });

  it('NÃO retenta em NOT_FOUND', async () => {
    const cancelReservation = vi.fn().mockResolvedValue(envelope('NOT_FOUND'));
    const result = await executeCancelReservation({ cancelReservation }, BASE_REQ);

    expect(cancelReservation).toHaveBeenCalledTimes(1);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('NÃO retenta em FORBIDDEN', async () => {
    const cancelReservation = vi.fn().mockResolvedValue(envelope('FORBIDDEN'));
    await executeCancelReservation({ cancelReservation }, BASE_REQ);
    expect(cancelReservation).toHaveBeenCalledTimes(1);
  });

  it('NÃO retenta em VALIDATION', async () => {
    const cancelReservation = vi.fn().mockResolvedValue(envelope('VALIDATION'));
    await executeCancelReservation({ cancelReservation }, BASE_REQ);
    expect(cancelReservation).toHaveBeenCalledTimes(1);
  });

  it('NÃO retenta em LOCK_TIMEOUT', async () => {
    const cancelReservation = vi.fn().mockResolvedValue(envelope('LOCK_TIMEOUT'));
    await executeCancelReservation({ cancelReservation }, BASE_REQ);
    expect(cancelReservation).toHaveBeenCalledTimes(1);
  });

  it('retenta em INTERNAL com o MESMO clientRequestId', async () => {
    const cancelReservation = vi
      .fn()
      .mockResolvedValueOnce(envelope('INTERNAL'))
      .mockResolvedValueOnce(OK_RES);

    const result = await executeCancelReservation({ cancelReservation }, BASE_REQ, {
      maxRetries: 2,
    });

    expect(cancelReservation).toHaveBeenCalledTimes(2);
    const firstId = cancelReservation.mock.calls[0][0].clientRequestId;
    const secondId = cancelReservation.mock.calls[1][0].clientRequestId;
    expect(firstId).toBe(secondId);
    expect(firstId).toBe('11111111-2222-3333-4444-555555555555');
    expect(result.ok).toBe(true);
  });

  it('retenta em falha de rede com o MESMO clientRequestId', async () => {
    const cancelReservation = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Network down'))
      .mockResolvedValueOnce(OK_RES);

    const result = await executeCancelReservation({ cancelReservation }, BASE_REQ, {
      maxRetries: 2,
    });

    expect(cancelReservation).toHaveBeenCalledTimes(2);
    const firstId = cancelReservation.mock.calls[0][0].clientRequestId;
    const secondId = cancelReservation.mock.calls[1][0].clientRequestId;
    expect(firstId).toBe(secondId);
    expect(result.ok).toBe(true);
  });

  it('após esgotar retries em INTERNAL, devolve o último envelope ok=false', async () => {
    const cancelReservation = vi.fn().mockResolvedValue(envelope('INTERNAL'));

    const result = await executeCancelReservation({ cancelReservation }, BASE_REQ, {
      maxRetries: 2,
    });

    expect(cancelReservation).toHaveBeenCalledTimes(3); // 1 inicial + 2 retries
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INTERNAL');
  });

  it('após esgotar retries em falha de rede, lança o erro', async () => {
    const cancelReservation = vi.fn().mockRejectedValue(new TypeError('Network down'));

    await expect(
      executeCancelReservation({ cancelReservation }, BASE_REQ, { maxRetries: 1 }),
    ).rejects.toThrow('Network down');
    expect(cancelReservation).toHaveBeenCalledTimes(2);
  });

  it('respeita clientRequestId fornecido externamente', async () => {
    const cancelReservation = vi.fn().mockResolvedValue(OK_RES);

    await executeCancelReservation({ cancelReservation }, BASE_REQ, {
      clientRequestId: 'externo-9999',
    });

    expect(cancelReservation.mock.calls[0][0].clientRequestId).toBe('externo-9999');
  });

  it('encaminha payload.id ao service', async () => {
    const cancelReservation = vi.fn().mockResolvedValue(OK_RES);

    await executeCancelReservation({ cancelReservation }, BASE_REQ);

    expect(cancelReservation.mock.calls[0][0].payload).toEqual({ id: 'r-1' });
  });

  it('encaminha userEmail ao service', async () => {
    const cancelReservation = vi.fn().mockResolvedValue(OK_RES);

    await executeCancelReservation({ cancelReservation }, BASE_REQ);

    expect(cancelReservation.mock.calls[0][0].userEmail).toBe('professor@senai.edu');
  });

  it('gera clientRequestId via crypto.randomUUID quando não fornecido', async () => {
    const cancelReservation = vi.fn().mockResolvedValue(OK_RES);

    await executeCancelReservation({ cancelReservation }, BASE_REQ);

    expect(cancelReservation.mock.calls[0][0].clientRequestId).toBe(
      '11111111-2222-3333-4444-555555555555',
    );
  });

  it('idempotência por estado: reserva já CANCELLED retorna ok=true sem retry', async () => {
    // Documenta: backend pula owner-check e retorna ok=true se status já é CANCELLED.
    // A função execute passa o envelope de volta sem lógica adicional.
    const alreadyCancelled: CancelReservationResponse = {
      ok: true,
      data: { ...OK_RES.data!, status: 'CANCELLED' },
      error: null,
    };
    const cancelReservation = vi.fn().mockResolvedValue(alreadyCancelled);

    const result = await executeCancelReservation({ cancelReservation }, BASE_REQ);

    expect(cancelReservation).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.data?.status).toBe('CANCELLED');
  });
});
