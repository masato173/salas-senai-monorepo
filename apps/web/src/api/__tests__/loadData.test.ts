import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApiClient } from '../client';

// TDD: testes escritos ANTES da implementação

const MOCK_RESPONSE = {
  ok: true,
  total: 3,
  dados: [
    { data: '2026-01-12', sala: '603 Sala', turma: 'APB.OPL.015', mes: 'Janeiro' },
    { data: '2026-01-12', sala: '605 Sala', turma: 'APB.ADM.148', mes: 'Janeiro' },
  ],
  turnoMap: { 'APB.OPL.015': 'V', 'APB.ADM.148': 'M' },
};

describe('createApiClient()', () => {
  const config = { url: 'https://script.google.com/exec', token: 'test-token' };

  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve(MOCK_RESPONSE),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('chama fetch com URL e token corretos', async () => {
    const client = createApiClient(config);
    await client.fetchData();
    expect(fetch).toHaveBeenCalledWith(
      'https://script.google.com/exec?token=test-token',
    );
  });

  it('retorna dados e turnoMap', async () => {
    const client = createApiClient(config);
    const result = await client.fetchData();
    expect(result.dados).toHaveLength(2);
    expect(result.turnoMap).toEqual({ 'APB.OPL.015': 'V', 'APB.ADM.148': 'M' });
  });

  it('lança erro se API retornar error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ error: 'Acesso negado.' }),
    } as Response);
    const client = createApiClient(config);
    await expect(client.fetchData()).rejects.toThrow('Falha ao carregar dados.');
  });

  it('lança erro se fetch falhar (rede)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const client = createApiClient(config);
    await expect(client.fetchData()).rejects.toThrow();
  });

  it('retorna arrays vazios se campos estiverem ausentes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ ok: true }),
    } as Response);
    const client = createApiClient(config);
    const result = await client.fetchData();
    expect(result.dados).toEqual([]);
    expect(result.turnoMap).toEqual({});
  });
});
