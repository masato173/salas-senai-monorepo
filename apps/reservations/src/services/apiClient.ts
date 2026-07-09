import {
  useAuthStore,
  selectAccessToken,
  selectRefreshToken,
  selectUser,
} from '../store/authStore';

// ─────────────────────────────────────────────────────────────
// ApiClient — F5.2
//
// Responsabilidades:
//   1. Injetar Authorization: Bearer {accessToken}
//   2. Em 401 → refreshAccessToken() → retry 1x
//   3. Em 401 após retry → clearAuth() (ProtectedRoute redireciona)
//   4. refreshLock → impede refresh concorrente
//
// NÃO navega. NÃO conhece React Router.
// Separação de responsabilidades:
//   apiClient   → HTTP + refresh
//   authStore   → estado de autenticação
//   tokenStorage→ persistência
//   ProtectedRoute → navegação
// ─────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Erro HTTP tipado — F5.3 captura e converte para BackendEnvelope
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string | undefined,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Async function que sempre lança — retorna Promise<never>
// para que TypeScript saiba que o caller não precisa de fallback.
async function throwForStatus(res: Response): Promise<never> {
  let message = `Erro ${res.status}`;
  let code: string | undefined;
  try {
    const body = (await res.json()) as { message?: string; error?: string };
    if (typeof body.message === 'string') message = body.message;
    if (typeof body.error === 'string') code = body.error;
  } catch {
    /* sem body JSON — ignora */
  }
  throw new ApiError(res.status, message, code);
}

// refreshLock — módulo-level.
// Uma única Promise partilhada por todas as requests concorrentes.
let refreshLock: Promise<void> | null = null;

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

async function doRefresh(): Promise<void> {
  const refreshToken = selectRefreshToken(useAuthStore.getState());
  if (refreshToken === null) {
    useAuthStore.getState().clearAuth();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      useAuthStore.getState().clearAuth();
      return;
    }

    const data = (await res.json()) as RefreshResponse;
    const user = selectUser(useAuthStore.getState());

    if (user === null) {
      // Store limpo durante o refresh (race condition) — abortar
      useAuthStore.getState().clearAuth();
      return;
    }

    // Preserva o user, atualiza ambos os tokens
    useAuthStore.getState().setAuth({
      user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
  } catch {
    // Falha de rede — limpamos o estado
    useAuthStore.getState().clearAuth();
  }
}

async function refreshAccessToken(): Promise<void> {
  if (refreshLock !== null) {
    // Outra request já está renovando — aguarda a mesma Promise
    await refreshLock;
    return;
  }

  refreshLock = doRefresh().finally(() => {
    refreshLock = null;
  });

  await refreshLock;
}

function buildHeaders(
  accessToken: string | null,
  extra?: HeadersInit | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken !== null) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (extra !== undefined) {
    for (const [k, v] of new Headers(extra).entries()) {
      headers[k] = v;
    }
  }
  return headers;
}

// Função central do ApiClient.
// Lança ApiError em qualquer resposta não-ok.
// Resposta 204 retorna null (endpoints sem body, ex: DELETE).
// F5.3 usa apiFetch internamente e envolve em BackendEnvelope.
export async function apiFetch<T>(path: string, init?: RequestInit | undefined): Promise<T> {
  const token = selectAccessToken(useAuthStore.getState());
  const headers = buildHeaders(token, init?.headers);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    await refreshAccessToken();

    const newToken = selectAccessToken(useAuthStore.getState());
    if (newToken === null) {
      // Refresh falhou — ProtectedRoute vai detectar e redirecionar
      throw new ApiError(401, 'Sessão expirada. Faça login novamente.');
    }

    // Retry 1x com o novo token
    const retry = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: buildHeaders(newToken, init?.headers),
    });

    if (retry.status === 204) return null as unknown as T;
    if (!retry.ok) return throwForStatus(retry);
    return retry.json() as Promise<T>;
  }

  if (res.status === 204) return null as unknown as T;
  if (!res.ok) return throwForStatus(res);
  return res.json() as Promise<T>;
}
