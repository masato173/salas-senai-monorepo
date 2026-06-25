import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeUpdateReservationSelected } from '../useUpdateReservationSelected';
import type {
  UpdateReservationSelectedRequest,
  UpdateReservationSelectedResponse,
  BackendErrorCode,
  CreatedReservationRow,
} from '../../services/appsScript';

// ─────────────────────────────────────────────────────────────
// Sprint 4 D4.5a — testes do hook do C3 (updateReservationSelected).
//
// ⚠️ DIFERENÇA CRÍTICA vs useUpdateReservationGroup.test.ts:
// O hook do C3 tem maxRetries DEFAULT 0 (não 2). Razão: o backend C3 faz
// SPLIT com novo UUID a cada chamada — retentar em INTERNAL/rede produz
// duplo split = reservas duplicadas. Decisão consciente, FLAG 1 do
// codigo.gs.sprint4-C3 e do useUpdateReservationSelected.ts.
//
// Os 2 testes-guardiões "★ FLAG 1" abaixo provam que o hook chama o service
// EXATAMENTE 1 vez em INTERNAL e em falha de rede — em contraste com o teste
// equivalente do Group que espera 3 chamadas (1 inicial + 2 retries).
// Se alguém mudar pra maxRetries:2, esses 2 testes DEVEM quebrar.
//
// DUPLICATE não é retornado por updateReservationSelected — pulamos.
// CONFLICT É retornado (atomicidade tudo-ou-nada por data selecionada) e
// nunca retentável — testado abaixo.
// ─────────────────────────────────────────────────────────────

const BASE_PAYLOAD = {
  ids: ['r-1', 'r-2'],
  sala: '611 Sala',
  inicio: '16:00',
  fim: '17:00',
  turma: 'ADS-B',
  observacao: 'remanejado',
};

const BASE_REQ: Omit<UpdateReservationSelectedRequest, 'clientRequestId'> = {
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
    observacao: 'remanejado',
    status: 'ACTIVE',
    createdBy: 'professor@senai.edu',
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-10T10:00:00.000Z',
    // C3 — novo UUID compartilhado entre as selecionadas após o split.
    groupId: 'new-uuid-shared',
    ...overrides,
  };
}

const OK_RES: UpdateReservationSelectedResponse = {
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

function envelope(code: BackendErrorCode): UpdateReservationSelectedResponse {
  return { ok: false, data: null, error: { code, message: `erro ${code}` } };
}

describe('executeUpdateReservationSelected()', () => {
  beforeEach(() => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555',
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────
  // Sucesso e shape
  // ──────────────────────────────────────────────────────────

  it('repassa ok=true do backend sem retentar (sucesso normal)', async () => {
    const updateReservationSelected = vi.fn().mockResolvedValue(OK_RES);
    const result = await executeUpdateReservationSelected({ updateReservationSelected }, BASE_REQ);

    expect(updateReservationSelected).toHaveBeenCalledTimes(1);
    expect(result).toEqual(OK_RES);
  });

  it('preserva o shape { count, reservations } no envelope e o novo groupId compartilhado', async () => {
    const updateReservationSelected = vi.fn().mockResolvedValue(OK_RES);
    const result = await executeUpdateReservationSelected({ updateReservationSelected }, BASE_REQ);

    expect(result.ok).toBe(true);
    expect(result.data?.count).toBe(2);
    expect(result.data?.reservations).toHaveLength(2);
    // C3: as N selecionadas (N>=2) recebem novo UUID compartilhado entre si.
    const groupIds = result.data!.reservations.map(r => r.groupId);
    expect(new Set(groupIds).size).toBe(1);
    expect(groupIds[0]).toBe('new-uuid-shared');
  });

  // ──────────────────────────────────────────────────────────
  // ★★★ GUARDIÕES DA FLAG 1 — os testes mais importantes do arquivo.
  // ──────────────────────────────────────────────────────────

  it('★ FLAG 1 — NÃO retenta em INTERNAL: chama o service EXATAMENTE 1 vez (maxRetries:0)', async () => {
    // FLAG 1 — retry no C3 duplica split (novo UUID por tentativa).
    // Se alguém mudar pra maxRetries:2, este teste DEVE quebrar. É o guardião.
    //
    // Contraste explícito: o teste equivalente no useUpdateReservationGroup
    // espera 3 chamadas (1 inicial + 2 retries default). Aqui é 1.
    // Essa diferença É o ponto desta fase.
    const updateReservationSelected = vi.fn().mockResolvedValue(envelope('INTERNAL'));

    const result = await executeUpdateReservationSelected({ updateReservationSelected }, BASE_REQ);

    expect(updateReservationSelected).toHaveBeenCalledTimes(1); // ← 1, NÃO 3
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INTERNAL');
  });

  it('★ FLAG 1 — NÃO retenta em falha de rede: chama 1 vez e LANÇA o erro', async () => {
    // FLAG 1 — mesma razão. No Group este teste espera 2 chamadas (1+1 retry).
    // No Selected: 1 chamada e o erro propagado pra cima.
    const updateReservationSelected = vi.fn().mockRejectedValue(new TypeError('Network down'));

    await expect(
      executeUpdateReservationSelected({ updateReservationSelected }, BASE_REQ),
    ).rejects.toThrow('Network down');

    expect(updateReservationSelected).toHaveBeenCalledTimes(1); // ← 1, NÃO 2
  });

  // ──────────────────────────────────────────────────────────
  // Erros não-retryable (todos: 1 chamada — independente da política,
  // porque essas categorias nunca são retentadas)
  // ──────────────────────────────────────────────────────────

  it('NÃO retenta em NOT_FOUND', async () => {
    const updateReservationSelected = vi.fn().mockResolvedValue(envelope('NOT_FOUND'));
    const result = await executeUpdateReservationSelected({ updateReservationSelected }, BASE_REQ);

    expect(updateReservationSelected).toHaveBeenCalledTimes(1);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('NÃO retenta em FORBIDDEN', async () => {
    const updateReservationSelected = vi.fn().mockResolvedValue(envelope('FORBIDDEN'));
    await executeUpdateReservationSelected({ updateReservationSelected }, BASE_REQ);
    expect(updateReservationSelected).toHaveBeenCalledTimes(1);
  });

  it('NÃO retenta em VALIDATION', async () => {
    const updateReservationSelected = vi.fn().mockResolvedValue(envelope('VALIDATION'));
    await executeUpdateReservationSelected({ updateReservationSelected }, BASE_REQ);
    expect(updateReservationSelected).toHaveBeenCalledTimes(1);
  });

  it('NÃO retenta em LOCK_TIMEOUT', async () => {
    const updateReservationSelected = vi.fn().mockResolvedValue(envelope('LOCK_TIMEOUT'));
    await executeUpdateReservationSelected({ updateReservationSelected }, BASE_REQ);
    expect(updateReservationSelected).toHaveBeenCalledTimes(1);
  });

  it('NÃO retenta em CONFLICT', async () => {
    // updateReservationSelected retorna CONFLICT se QUALQUER data selecionada
    // conflita (atomicidade tudo-ou-nada — test-sprint4-C3.ps1 T4).
    const updateReservationSelected = vi.fn().mockResolvedValue(envelope('CONFLICT'));
    const result = await executeUpdateReservationSelected({ updateReservationSelected }, BASE_REQ);
    expect(updateReservationSelected).toHaveBeenCalledTimes(1);
    expect(result.error?.code).toBe('CONFLICT');
  });

  // ──────────────────────────────────────────────────────────
  // clientRequestId — geração e propagação
  // ──────────────────────────────────────────────────────────

  it('respeita clientRequestId fornecido externamente', async () => {
    const updateReservationSelected = vi.fn().mockResolvedValue(OK_RES);

    await executeUpdateReservationSelected({ updateReservationSelected }, BASE_REQ, {
      clientRequestId: 'externo-9999',
    });

    expect(updateReservationSelected.mock.calls[0][0].clientRequestId).toBe('externo-9999');
  });

  it('gera clientRequestId via crypto.randomUUID quando não fornecido', async () => {
    const updateReservationSelected = vi.fn().mockResolvedValue(OK_RES);

    await executeUpdateReservationSelected({ updateReservationSelected }, BASE_REQ);

    expect(updateReservationSelected.mock.calls[0][0].clientRequestId).toBe(
      '11111111-2222-3333-4444-555555555555',
    );
  });

  // ──────────────────────────────────────────────────────────
  // Encaminhamento de payload e userEmail
  // ──────────────────────────────────────────────────────────

  it('encaminha payload do C3 ao service (ids/sala/inicio/fim/turma/observacao — sem data)', async () => {
    const updateReservationSelected = vi.fn().mockResolvedValue(OK_RES);

    await executeUpdateReservationSelected({ updateReservationSelected }, BASE_REQ);

    expect(updateReservationSelected.mock.calls[0][0].payload).toEqual(BASE_PAYLOAD);
    // Cada linha do grupo mantém a sua data — payload do C3 SEM data.
    expect(updateReservationSelected.mock.calls[0][0].payload).not.toHaveProperty('data');
    // E sem groupId (o C3 trabalha com ids[], não groupId).
    expect(updateReservationSelected.mock.calls[0][0].payload).not.toHaveProperty('groupId');
    // ids é o que distingue o C3.
    expect(updateReservationSelected.mock.calls[0][0].payload.ids).toEqual(['r-1', 'r-2']);
  });

  it('encaminha userEmail ao service', async () => {
    const updateReservationSelected = vi.fn().mockResolvedValue(OK_RES);

    await executeUpdateReservationSelected({ updateReservationSelected }, BASE_REQ);

    expect(updateReservationSelected.mock.calls[0][0].userEmail).toBe('professor@senai.edu');
  });
});
