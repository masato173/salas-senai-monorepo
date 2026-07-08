import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchAvailability } from '../useAvailabilityBackend';
import type { AvailabilityResult } from '../../types';

// Testa a função pura fetchAvailability — sem React, sem hooks.
// O hook React (useAvailabilityBackend) é testado manualmente no browser.

const MOCK_RESULT: AvailabilityResult = {
  data: '2026-07-10',
  salas: [{ sala: '01 Sala', status: 'livre', eventos: [] }],
  geradoEm: '2026-07-10T00:00:00.000Z',
};

function mockFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

describe('fetchAvailability()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('faz GET com date sem turno e retorna AvailabilityResult', async () => {
    mockFetch(200, MOCK_RESULT);

    const result = await fetchAvailability({ date: '2026-07-10' }, 'http://api');

    expect(fetch).toHaveBeenCalledWith('http://api/availability?date=2026-07-10');
    expect(result).toEqual(MOCK_RESULT);
  });

  it('faz GET com date e turno na query string', async () => {
    mockFetch(200, MOCK_RESULT);

    await fetchAvailability({ date: '2026-07-10', turno: 'M' }, 'http://api');

    expect(fetch).toHaveBeenCalledWith('http://api/availability?date=2026-07-10&turno=M');
  });

  it('não inclui turno na query quando undefined', async () => {
    mockFetch(200, MOCK_RESULT);

    await fetchAvailability({ date: '2026-07-10', turno: undefined }, 'http://api');

    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).not.toContain('turno');
  });

  it('lança erro em resposta HTTP 400', async () => {
    mockFetch(400, { message: 'date inválido' });

    await expect(fetchAvailability({ date: 'invalido' }, 'http://api')).rejects.toThrow('HTTP 400');
  });

  it('lança erro em resposta HTTP 500', async () => {
    mockFetch(500, {});

    await expect(fetchAvailability({ date: '2026-07-10' }, 'http://api')).rejects.toThrow(
      'HTTP 500',
    );
  });
});
