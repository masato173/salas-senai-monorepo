import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeUpdateReservation } from '../useUpdateReservation';
import type {
  UpdateReservationRequest,
  UpdateReservationResponse,
  BackendErrorCode,
} from '../../services/apiTypes';

// DUPLICATE não é retornado por updateReservation — pulamos.
// CONFLICT É retornado (editar pra horário ocupado por outra ACTIVE) e
// NÃO deve ser retentado — testado abaixo.
//
// Idempotência state-based (payload === row atual → no-op no backend) é
// responsabilidade do BACKEND, verificada em test-sprint4-C1.ps1 T7. No
// hook, esse caminho é indistinguível de um sucesso normal — ambos voltam
// como envelope ok=true. O teste "sucesso" cobre os dois cenários.

const BASE_REQ: Omit<UpdateReservationRequest, 'clientRequestId'> = {
  userEmail: 'professor@senai.edu',
  payload: {
    id: 'r-1',
    sala: '604 Sala',
    data: '2026-12-10',
    inicio: '10:00',
    fim: '11:00',
    turma: 'ADS-A',
    observacao: '',
  },
};

const OK_RES: UpdateReservationResponse = {
  ok: true,
  data: {
    id: 'r-1',
    sala: '604 Sala',
    data: '2026-12-10',
    inicio: '10:00',
    fim: '11:00',
    professor: 'Fulano',
    turma: 'ADS-A',
    observacao: '',
    status: 'ACTIVE',
    createdBy: 'professor@senai.edu',
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-10T10:00:00.000Z',
    groupId: 'r-1', // Sprint 4 Fase A: única → groupId === id
  },
  error: null,
};

function envelope(code: BackendErrorCode): UpdateReservationResponse {
  return { ok: false, data: null, error: { code, message: `erro ${code}` } };
}

describe('executeUpdateReservation()', () => {
  beforeEach(() => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555',
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('repassa ok=true do backend sem retentar (sucesso normal OU no-op state-based — backend decide)', async () => {
    // O caminho "no-op state-based" (test-sprint4-C1.ps1 T7) cai aqui também:
    // pra o hook, é indistinguível de um sucesso normal — envelope ok=true encerra o ciclo.
    // A idempotência em si é provada no PowerShell, não aqui.
    const updateReservation = vi.fn().mockResolvedValue(OK_RES);
    const result = await executeUpdateReservation({ updateReservation }, BASE_REQ);

    expect(updateReservation).toHaveBeenCalledTimes(1);
    expect(result).toEqual(OK_RES);
  });

  it('NÃO retenta em NOT_FOUND', async () => {
    const updateReservation = vi.fn().mockResolvedValue(envelope('NOT_FOUND'));
    const result = await executeUpdateReservation({ updateReservation }, BASE_REQ);

    expect(updateReservation).toHaveBeenCalledTimes(1);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('NÃO retenta em FORBIDDEN', async () => {
    const updateReservation = vi.fn().mockResolvedValue(envelope('FORBIDDEN'));
    await executeUpdateReservation({ updateReservation }, BASE_REQ);
    expect(updateReservation).toHaveBeenCalledTimes(1);
  });

  it('NÃO retenta em VALIDATION', async () => {
    const updateReservation = vi.fn().mockResolvedValue(envelope('VALIDATION'));
    await executeUpdateReservation({ updateReservation }, BASE_REQ);
    expect(updateReservation).toHaveBeenCalledTimes(1);
  });

  it('NÃO retenta em LOCK_TIMEOUT', async () => {
    const updateReservation = vi.fn().mockResolvedValue(envelope('LOCK_TIMEOUT'));
    await executeUpdateReservation({ updateReservation }, BASE_REQ);
    expect(updateReservation).toHaveBeenCalledTimes(1);
  });

  it('NÃO retenta em CONFLICT', async () => {
    // updateReservation PODE retornar CONFLICT (editar pra horário ocupado por outra ACTIVE).
    // Retry não muda a situação: mesma resposta.
    const updateReservation = vi.fn().mockResolvedValue(envelope('CONFLICT'));
    const result = await executeUpdateReservation({ updateReservation }, BASE_REQ);
    expect(updateReservation).toHaveBeenCalledTimes(1);
    expect(result.error?.code).toBe('CONFLICT');
  });

  it('retenta em INTERNAL com o MESMO clientRequestId', async () => {
    const updateReservation = vi
      .fn()
      .mockResolvedValueOnce(envelope('INTERNAL'))
      .mockResolvedValueOnce(OK_RES);

    const result = await executeUpdateReservation({ updateReservation }, BASE_REQ, {
      maxRetries: 2,
    });

    expect(updateReservation).toHaveBeenCalledTimes(2);
    const firstId = updateReservation.mock.calls[0][0].clientRequestId;
    const secondId = updateReservation.mock.calls[1][0].clientRequestId;
    expect(firstId).toBe(secondId);
    expect(firstId).toBe('11111111-2222-3333-4444-555555555555');
    expect(result.ok).toBe(true);
  });

  it('retenta em falha de rede com o MESMO clientRequestId', async () => {
    const updateReservation = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Network down'))
      .mockResolvedValueOnce(OK_RES);

    const result = await executeUpdateReservation({ updateReservation }, BASE_REQ, {
      maxRetries: 2,
    });

    expect(updateReservation).toHaveBeenCalledTimes(2);
    const firstId = updateReservation.mock.calls[0][0].clientRequestId;
    const secondId = updateReservation.mock.calls[1][0].clientRequestId;
    expect(firstId).toBe(secondId);
    expect(result.ok).toBe(true);
  });

  it('após esgotar retries em INTERNAL, devolve o último envelope ok=false', async () => {
    const updateReservation = vi.fn().mockResolvedValue(envelope('INTERNAL'));

    const result = await executeUpdateReservation({ updateReservation }, BASE_REQ, {
      maxRetries: 2,
    });

    expect(updateReservation).toHaveBeenCalledTimes(3); // 1 inicial + 2 retries
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INTERNAL');
  });

  it('após esgotar retries em falha de rede, lança o erro', async () => {
    const updateReservation = vi.fn().mockRejectedValue(new TypeError('Network down'));

    await expect(
      executeUpdateReservation({ updateReservation }, BASE_REQ, { maxRetries: 1 }),
    ).rejects.toThrow('Network down');
    expect(updateReservation).toHaveBeenCalledTimes(2);
  });

  it('respeita clientRequestId fornecido externamente', async () => {
    const updateReservation = vi.fn().mockResolvedValue(OK_RES);

    await executeUpdateReservation({ updateReservation }, BASE_REQ, {
      clientRequestId: 'externo-9999',
    });

    expect(updateReservation.mock.calls[0][0].clientRequestId).toBe('externo-9999');
  });

  it('encaminha payload completo ao service (PUT-like)', async () => {
    const updateReservation = vi.fn().mockResolvedValue(OK_RES);

    await executeUpdateReservation({ updateReservation }, BASE_REQ);

    expect(updateReservation.mock.calls[0][0].payload).toEqual({
      id: 'r-1',
      sala: '604 Sala',
      data: '2026-12-10',
      inicio: '10:00',
      fim: '11:00',
      turma: 'ADS-A',
      observacao: '',
    });
  });

  it('encaminha userEmail ao service', async () => {
    const updateReservation = vi.fn().mockResolvedValue(OK_RES);

    await executeUpdateReservation({ updateReservation }, BASE_REQ);

    expect(updateReservation.mock.calls[0][0].userEmail).toBe('professor@senai.edu');
  });

  it('gera clientRequestId via crypto.randomUUID quando não fornecido', async () => {
    const updateReservation = vi.fn().mockResolvedValue(OK_RES);

    await executeUpdateReservation({ updateReservation }, BASE_REQ);

    expect(updateReservation.mock.calls[0][0].clientRequestId).toBe(
      '11111111-2222-3333-4444-555555555555',
    );
  });
});
