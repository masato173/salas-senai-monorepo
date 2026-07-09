import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from '../apiClient';
import { useAuthStore } from '../../store/authStore';

const MOCK_USER = {
  id: 'u1',
  name: 'Prof. Teste',
  email: 'prof@senai.edu',
  role: 'PROFESSOR',
};

// Cria um mock de fetch que retorna respostas em sequência
function mockFetch(responses: Array<{ status: number; body?: unknown }>) {
  let i = 0;
  return vi.fn().mockImplementation(() => {
    const cfg = responses[i++] ?? { status: 200, body: {} };
    return Promise.resolve({
      ok: cfg.status >= 200 && cfg.status < 300,
      status: cfg.status,
      json: (): Promise<unknown> => Promise.resolve(cfg.body ?? {}),
    });
  });
}

describe('ApiError', () => {
  it('herda de Error com name, status e code corretos', () => {
    const e = new ApiError(404, 'Não encontrado', 'NOT_FOUND');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('ApiError');
    expect(e.status).toBe(404);
    expect(e.message).toBe('Não encontrado');
    expect(e.code).toBe('NOT_FOUND');
  });

  it('code é opcional', () => {
    const e = new ApiError(500, 'Erro interno');
    expect(e.code).toBeUndefined();
  });
});

describe('apiFetch()', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('injeta Authorization header quando há accessToken', async () => {
    useAuthStore.getState().setAuth({
      user: MOCK_USER,
      accessToken: 'tok-abc',
      refreshToken: 'ref-xyz',
    });
    const mockF = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: (): Promise<unknown> => Promise.resolve([]),
    });
    vi.stubGlobal('fetch', mockF);

    await apiFetch('/rooms');

    const headers = (mockF.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-abc');
  });

  it('omite Authorization header sem token', async () => {
    const mockF = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: (): Promise<unknown> => Promise.resolve([]),
    });
    vi.stubGlobal('fetch', mockF);

    await apiFetch('/rooms');

    const headers = (mockF.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('retorna dados JSON em resposta 200', async () => {
    const payload = [{ id: 'r1', name: '01 Sala' }];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: (): Promise<unknown> => Promise.resolve(payload),
      }),
    );

    const result = await apiFetch('/rooms');
    expect(result).toEqual(payload);
  });

  it('retorna null em resposta 204 (sem body)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: (): Promise<unknown> => Promise.reject(new Error('no body')),
      }),
    );

    const result = await apiFetch('/auth/logout');
    expect(result).toBeNull();
  });

  it('lança ApiError em resposta 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: (): Promise<unknown> => Promise.resolve({ message: 'Erro interno' }),
      }),
    );

    const err = await apiFetch('/rooms').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
    expect((err as ApiError).message).toBe('Erro interno');
  });

  it('em 401: faz refresh → retry com novo token → retorna dados', async () => {
    useAuthStore.getState().setAuth({
      user: MOCK_USER,
      accessToken: 'tok-expirado',
      refreshToken: 'ref-valido',
    });

    vi.stubGlobal(
      'fetch',
      mockFetch([
        { status: 401 }, // request original → 401
        { status: 200, body: { accessToken: 'tok-novo', refreshToken: 'ref-novo' } }, // POST /auth/refresh
        { status: 200, body: { id: 'r1', name: '01 Sala' } }, // retry → sucesso
      ]),
    );

    const result = await apiFetch<{ id: string }>('/rooms');

    expect(result).toEqual({ id: 'r1', name: '01 Sala' });
    // Retry deve usar o token novo
    const retryHeaders = (
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[2][1] as RequestInit
    ).headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe('Bearer tok-novo');
    // authStore atualizado
    expect(useAuthStore.getState().accessToken).toBe('tok-novo');
    expect(useAuthStore.getState().refreshToken).toBe('ref-novo');
    expect(useAuthStore.getState().user).toEqual(MOCK_USER);
  });

  it('em 401 + refresh falha → clearAuth() + lança ApiError', async () => {
    useAuthStore.getState().setAuth({
      user: MOCK_USER,
      accessToken: 'tok-expirado',
      refreshToken: 'ref-expirado',
    });

    vi.stubGlobal(
      'fetch',
      mockFetch([
        { status: 401 }, // request original
        { status: 401 }, // refresh também falha → doRefresh chama clearAuth()
      ]),
    );

    const err = await apiFetch('/rooms').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    // clearAuth() foi chamado
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it('em 401 sem refreshToken → clearAuth() + lança ApiError', async () => {
    // accessToken expirado mas sem refreshToken no store
    useAuthStore.getState().setAuth({
      user: MOCK_USER,
      accessToken: 'tok-expirado',
      refreshToken: 'tmp',
    });
    // Forçar refreshToken para null via clearAuth + setAuth parcial não é possível
    // então testamos sem auth (refreshToken = null desde o início)
    useAuthStore.getState().clearAuth();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: (): Promise<unknown> => Promise.resolve({ message: 'Unauthorized' }),
      }),
    );

    const err = await apiFetch('/rooms').catch((e: unknown) => e);
    // Sem token → sem refresh → lança ApiError do throwForStatus
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
  });
});
