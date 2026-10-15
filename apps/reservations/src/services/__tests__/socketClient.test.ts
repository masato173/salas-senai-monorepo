import { describe, it, expect, vi, beforeEach } from 'vitest';

const { ioMock } = vi.hoisted(() => ({ ioMock: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: ioMock }));

function fakeSocket(): { on: () => void; disconnect: () => void; connected: boolean } {
  return { on: vi.fn(), disconnect: vi.fn(), connected: false };
}

// Recarrega o socketClient com outro API_BASE (o valor vem do build).
async function loadWithApiBase(apiBase: string): Promise<typeof import('../socketClient')> {
  vi.resetModules();
  vi.doMock('../../config/api', async () => ({
    ...(await vi.importActual<Record<string, unknown>>('../../config/api')),
    API_BASE: apiBase,
  }));
  return import('../socketClient');
}

// #21 — com API_BASE relativa, io('/api/rooms') entraria no namespace
// '/api/rooms' em /socket.io e a conexão falharia em silêncio.
describe('getSocket — URL e path do Socket.IO', () => {
  beforeEach(() => {
    ioMock.mockReset();
    ioMock.mockImplementation(fakeSocket);
  });

  it("API_BASE '/api' (nginx): origem do site + /rooms, transporte em /api/socket.io", async () => {
    const { getSocket } = await loadWithApiBase('/api');

    getSocket('token-ficticio');

    expect(ioMock).toHaveBeenCalledWith(
      `${window.location.origin}/rooms`,
      expect.objectContaining({ path: '/api/socket.io', auth: { token: 'token-ficticio' } }),
    );
  });

  it('API_BASE absoluta (build do Pages): mesma URL de hoje, path padrão /socket.io', async () => {
    const { getSocket } = await loadWithApiBase('https://api.exemplo.com');

    getSocket('token-ficticio');

    expect(ioMock).toHaveBeenCalledWith(
      'https://api.exemplo.com/rooms',
      expect.objectContaining({ path: '/socket.io' }),
    );
  });
});
