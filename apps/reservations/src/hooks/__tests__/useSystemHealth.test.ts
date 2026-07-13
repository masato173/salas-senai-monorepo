import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeSystemHealth } from '../useSystemHealth';

const mockService = { fetchHealth: vi.fn() };

const HEALTH_OK = {
  ok: true,
  data: {
    status: 'ok' as const,
    timestamp: '2026-07-12T10:00:00.000Z',
    uptime: 3600,
    version: '0.0.0-f4.0',
  },
  error: null,
};

const HEALTH_ERR = {
  ok: false,
  data: null,
  error: { code: 'INTERNAL' as const, message: 'Servidor inacessível.' },
};

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('executeSystemHealth()', () => {
  it('retorna apiStatus=ok quando /health responde', async () => {
    mockService.fetchHealth.mockResolvedValue(HEALTH_OK);
    const res = await executeSystemHealth(mockService);
    expect(res.ok).toBe(true);
    expect(res.data?.status).toBe('ok');
    expect(res.data?.uptime).toBe(3600);
    expect(res.data?.version).toBe('0.0.0-f4.0');
  });

  it('retorna ok=false quando /health falha', async () => {
    mockService.fetchHealth.mockResolvedValue(HEALTH_ERR);
    const res = await executeSystemHealth(mockService);
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INTERNAL');
  });

  it('delega ao service exatamente 1 vez', async () => {
    mockService.fetchHealth.mockResolvedValue(HEALTH_OK);
    await executeSystemHealth(mockService);
    expect(mockService.fetchHealth).toHaveBeenCalledTimes(1);
  });

  it('propaga erro de rede se service lança', async () => {
    mockService.fetchHealth.mockRejectedValue(new Error('network fail'));
    await expect(executeSystemHealth(mockService)).rejects.toThrow('network fail');
  });
});
