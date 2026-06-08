import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAppsScriptAdapter } from '../appsScriptAdapter';

// ── TDD RED: adapter não existe ainda ───────────────────────

const VALID_PAYLOAD = {
  ok: true, total: 3,
  dados: [
    { data: '2026-01-12', sala: '603 Sala', turma: 'APB.OPL.015', mes: 'Janeiro' },
    { data: '2026-02-25', sala: '607 Sala', turma: 'APB.OPL.123/OPL.124', mes: 'Fevereiro' },
    { data: '2026-02-25', sala: '610 Lab. Inf.', turma: 'SESI-FRANKLIN', mes: 'Fevereiro' },
  ],
  turnoMap: { 'APB.OPL.015': 'V', 'APB.OPL.123': 'N' },
};

describe('createAppsScriptAdapter()', () => {
  const config = {
    url:   'https://script.google.com/exec',
    token: 'test-token',
  };

  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve(VALID_PAYLOAD),
    } as Response);
  });

  afterEach(() => vi.restoreAllMocks());

  it('retorna NormalizedPayload com registros mapeados', async () => {
    const adapter = createAppsScriptAdapter(config);
    const result  = await adapter.fetchAndNormalize();

    expect(result.registros).toHaveLength(3);
    expect(result.turnoMap).toEqual({ 'APB.OPL.015': 'V', 'APB.OPL.123': 'N' });
    expect(result.total).toBe(3);
  });

  it('registros têm campos computados (turno, isLab, dateLabel)', async () => {
    const adapter = createAppsScriptAdapter(config);
    const result  = await adapter.fetchAndNormalize();

    const opl = result.registros.find(r => r.turma === 'APB.OPL.015');
    expect(opl?.turno).toBe('V');
    expect(opl?.isLab).toBe(false);
    expect(opl?.dateLabel).toMatch(/12\/01\/2026/);

    const lab = result.registros.find(r => r.sala === '610 Lab. Inf.');
    expect(lab?.isLab).toBe(true);
  });

  it('resolve turno de célula com barra', async () => {
    const adapter = createAppsScriptAdapter(config);
    const result  = await adapter.fetchAndNormalize();

    const barra = result.registros.find(r => r.turma === 'APB.OPL.123/OPL.124');
    expect(barra?.turno).toBe('N');
  });

  it('turno null para turma sem mapeamento (SESI-FRANKLIN)', async () => {
    const adapter = createAppsScriptAdapter(config);
    const result  = await adapter.fetchAndNormalize();

    const sesi = result.registros.find(r => r.turma === 'SESI-FRANKLIN');
    expect(sesi?.turno).toBeNull();
  });

  it('campos XSS são escapados em turmaEsc e salaEsc', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({
        ok: true, total: 1,
        dados: [{ data: '2026-01-12', sala: '<b>hack</b>', turma: '<script>xss</script>', mes: 'Janeiro' }],
        turnoMap: {},
      }),
    } as Response);

    const adapter = createAppsScriptAdapter(config);
    const result  = await adapter.fetchAndNormalize();

    expect(result.registros[0].turmaEsc).not.toContain('<script>');
    expect(result.registros[0].salaEsc).not.toContain('<b>');
    expect(result.registros[0].turmaEsc).toBe('&lt;script&gt;xss&lt;/script&gt;');
  });

  it('lança AppError se API retornar { error: ... }', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ error: 'Acesso negado.' }),
    } as Response);

    const adapter = createAppsScriptAdapter(config);
    await expect(adapter.fetchAndNormalize()).rejects.toMatchObject({
      code: 'API_ERROR',
    });
  });

  it('lança AppError se fetch falhar', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const adapter = createAppsScriptAdapter(config);
    await expect(adapter.fetchAndNormalize()).rejects.toThrow();
  });

  it('dados com registros inválidos são descartados, válidos preservados', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({
        ok: true, total: 2,
        dados: [
          { data: '2026-01-12', sala: '603 Sala', turma: 'APB.OPL.015', mes: 'Janeiro' }, // válido
          { data: 'INVALID',    sala: '',          turma: '',              mes: ''        }, // inválido
        ],
        turnoMap: {},
      }),
    } as Response);

    const adapter = createAppsScriptAdapter(config);
    const result  = await adapter.fetchAndNormalize();
    expect(result.registros).toHaveLength(1);
  });
});
