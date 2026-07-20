import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeUpdateReservationGroup } from '../useUpdateReservationGroup';
import type {
  UpdateReservationGroupRequest,
  UpdateReservationGroupResponse,
  BackendErrorCode,
  CreatedReservationRow,
} from '../../services/apiTypes';

// DUPLICATE não é retornado por updateReservationGroup — pulamos.
// CONFLICT É retornado (atomicidade tudo-ou-nada: qualquer linha do grupo
// que conflite → CONFLICT pra todas) e NÃO deve ser retentado — testado abaixo.
//
// Idempotência state-based no GRUPO e a atomicidade do conflito são do
// BACKEND, verificadas em test-sprint4-C2.ps1 T4 (atomic conflict) e T7
// (no-op state-based). O hook só repassa o envelope. O teste "sucesso"
// cobre tanto o caso real de mudança quanto o no-op state-based — pra o
// hook são indistinguíveis.

const BASE_PAYLOAD = {
  groupId: 'grp-shared-xyz',
  sala: '611 Sala',
  inicio: '16:00',
  fim: '17:00',
  turma: 'ADS-B',
  observacao: 'grupo',
};

const BASE_REQ: Omit<UpdateReservationGroupRequest, 'clientRequestId'> = {
  userEmail: 'professor@senai.edu',
  payload: BASE_PAYLOAD,
};

function rowFixture(overrides: Partial<CreatedReservationRow> = {}): CreatedReservationRow {
  return {
    id: 'r-1',
    sala: '611 Sala',
    data: '2026-12-10',
    inicio: '16:00',
    fim: '17:00',
    professor: 'Fulano',
    turma: 'ADS-B',
    observacao: 'grupo',
    status: 'ACTIVE',
    createdBy: 'professor@senai.edu',
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-10T10:00:00.000Z',
    groupId: 'grp-shared-xyz',
    ...overrides,
  };
}

const OK_RES: UpdateReservationGroupResponse = {
  ok: true,
  data: {
    count: 2,
    reservations: [
      rowFixture({ id: 'r-1', data: '2026-12-10' }),
      rowFixture({ id: 'r-2', data: '2026-12-17' }),
    ],
  },
  error: null,
};

function envelope(code: BackendErrorCode): UpdateReservationGroupResponse {
  return { ok: false, data: null, error: { code, message: `erro ${code}` } };
}

describe('executeUpdateReservationGroup()', () => {
  beforeEach(() => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555',
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('repassa ok=true do backend sem retentar (sucesso normal OU no-op state-based — backend decide)', async () => {
    // O caminho "no-op state-based" no grupo (test-sprint4-C2.ps1 T7) cai aqui também:
    // pra o hook, é indistinguível de um sucesso normal — envelope ok=true encerra o ciclo.
    // A idempotência em si é provada no PowerShell, não aqui.
    const updateReservationGroup = vi.fn().mockResolvedValue(OK_RES);
    const result = await executeUpdateReservationGroup({ updateReservationGroup }, BASE_REQ);

    expect(updateReservationGroup).toHaveBeenCalledTimes(1);
    expect(result).toEqual(OK_RES);
  });

  it('preserva o shape { count, reservations } no envelope', async () => {
    const updateReservationGroup = vi.fn().mockResolvedValue(OK_RES);
    const result = await executeUpdateReservationGroup({ updateReservationGroup }, BASE_REQ);

    expect(result.ok).toBe(true);
    expect(result.data?.count).toBe(2);
    expect(result.data?.reservations).toHaveLength(2);
    // Todas as linhas do grupo carregam o mesmo groupId (Fase A).
    const groupIds = result.data!.reservations.map(r => r.groupId);
    expect(new Set(groupIds).size).toBe(1);
    expect(groupIds[0]).toBe('grp-shared-xyz');
  });

  it('NÃO retenta em NOT_FOUND', async () => {
    const updateReservationGroup = vi.fn().mockResolvedValue(envelope('NOT_FOUND'));
    const result = await executeUpdateReservationGroup({ updateReservationGroup }, BASE_REQ);

    expect(updateReservationGroup).toHaveBeenCalledTimes(1);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('NÃO retenta em FORBIDDEN', async () => {
    const updateReservationGroup = vi.fn().mockResolvedValue(envelope('FORBIDDEN'));
    await executeUpdateReservationGroup({ updateReservationGroup }, BASE_REQ);
    expect(updateReservationGroup).toHaveBeenCalledTimes(1);
  });

  it('NÃO retenta em VALIDATION', async () => {
    const updateReservationGroup = vi.fn().mockResolvedValue(envelope('VALIDATION'));
    await executeUpdateReservationGroup({ updateReservationGroup }, BASE_REQ);
    expect(updateReservationGroup).toHaveBeenCalledTimes(1);
  });

  it('NÃO retenta em LOCK_TIMEOUT', async () => {
    const updateReservationGroup = vi.fn().mockResolvedValue(envelope('LOCK_TIMEOUT'));
    await executeUpdateReservationGroup({ updateReservationGroup }, BASE_REQ);
    expect(updateReservationGroup).toHaveBeenCalledTimes(1);
  });

  it('NÃO retenta em CONFLICT', async () => {
    // updateReservationGroup retorna CONFLICT se QUALQUER data do grupo conflita
    // (atomicidade tudo-ou-nada — test-sprint4-C2.ps1 T4). Retry não muda a situação.
    const updateReservationGroup = vi.fn().mockResolvedValue(envelope('CONFLICT'));
    const result = await executeUpdateReservationGroup({ updateReservationGroup }, BASE_REQ);
    expect(updateReservationGroup).toHaveBeenCalledTimes(1);
    expect(result.error?.code).toBe('CONFLICT');
  });

  it('retenta em INTERNAL com o MESMO clientRequestId', async () => {
    const updateReservationGroup = vi
      .fn()
      .mockResolvedValueOnce(envelope('INTERNAL'))
      .mockResolvedValueOnce(OK_RES);

    const result = await executeUpdateReservationGroup({ updateReservationGroup }, BASE_REQ, {
      maxRetries: 2,
    });

    expect(updateReservationGroup).toHaveBeenCalledTimes(2);
    const firstId = updateReservationGroup.mock.calls[0][0].clientRequestId;
    const secondId = updateReservationGroup.mock.calls[1][0].clientRequestId;
    expect(firstId).toBe(secondId);
    expect(firstId).toBe('11111111-2222-3333-4444-555555555555');
    expect(result.ok).toBe(true);
  });

  it('retenta em falha de rede com o MESMO clientRequestId', async () => {
    const updateReservationGroup = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Network down'))
      .mockResolvedValueOnce(OK_RES);

    const result = await executeUpdateReservationGroup({ updateReservationGroup }, BASE_REQ, {
      maxRetries: 2,
    });

    expect(updateReservationGroup).toHaveBeenCalledTimes(2);
    const firstId = updateReservationGroup.mock.calls[0][0].clientRequestId;
    const secondId = updateReservationGroup.mock.calls[1][0].clientRequestId;
    expect(firstId).toBe(secondId);
    expect(result.ok).toBe(true);
  });

  it('após esgotar retries em INTERNAL, devolve o último envelope ok=false', async () => {
    const updateReservationGroup = vi.fn().mockResolvedValue(envelope('INTERNAL'));

    const result = await executeUpdateReservationGroup({ updateReservationGroup }, BASE_REQ, {
      maxRetries: 2,
    });

    expect(updateReservationGroup).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INTERNAL');
  });

  it('após esgotar retries em falha de rede, lança o erro', async () => {
    const updateReservationGroup = vi.fn().mockRejectedValue(new TypeError('Network down'));

    await expect(
      executeUpdateReservationGroup({ updateReservationGroup }, BASE_REQ, { maxRetries: 1 }),
    ).rejects.toThrow('Network down');
    expect(updateReservationGroup).toHaveBeenCalledTimes(2);
  });

  it('respeita clientRequestId fornecido externamente', async () => {
    const updateReservationGroup = vi.fn().mockResolvedValue(OK_RES);

    await executeUpdateReservationGroup({ updateReservationGroup }, BASE_REQ, {
      clientRequestId: 'externo-9999',
    });

    expect(updateReservationGroup.mock.calls[0][0].clientRequestId).toBe('externo-9999');
  });

  it('encaminha payload do grupo ao service (groupId/sala/inicio/fim/turma/observacao — sem data)', async () => {
    const updateReservationGroup = vi.fn().mockResolvedValue(OK_RES);

    await executeUpdateReservationGroup({ updateReservationGroup }, BASE_REQ);

    expect(updateReservationGroup.mock.calls[0][0].payload).toEqual(BASE_PAYLOAD);
    // Garante explicitamente que `data` NÃO foi enviado (cada linha mantém a sua).
    expect(updateReservationGroup.mock.calls[0][0].payload).not.toHaveProperty('data');
  });

  it('encaminha userEmail ao service', async () => {
    const updateReservationGroup = vi.fn().mockResolvedValue(OK_RES);

    await executeUpdateReservationGroup({ updateReservationGroup }, BASE_REQ);

    expect(updateReservationGroup.mock.calls[0][0].userEmail).toBe('professor@senai.edu');
  });

  it('gera clientRequestId via crypto.randomUUID quando não fornecido', async () => {
    const updateReservationGroup = vi.fn().mockResolvedValue(OK_RES);

    await executeUpdateReservationGroup({ updateReservationGroup }, BASE_REQ);

    expect(updateReservationGroup.mock.calls[0][0].clientRequestId).toBe(
      '11111111-2222-3333-4444-555555555555',
    );
  });
});
