import type { AuthUser } from '../store/authStore';

// ─────────────────────────────────────────────────────────────
// tokenStorage — camada de persistência isolada.
// Swappable sem tocar AuthStore ou ApiClient:
//   localStorage  → atual
//   sessionStorage → modo kiosk (sem persistência entre sessões)
//   in-memory     → testes / modo privado fallback
//   SecureStore   → futuro React Native / Electron
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'senai-auth-v1';

export interface StoredAuth {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
}

const EMPTY: StoredAuth = { user: null, accessToken: null, refreshToken: null };

export const tokenStorage = {
  read(): StoredAuth {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return EMPTY;
      const parsed = JSON.parse(raw) as Partial<StoredAuth>;
      return {
        user: parsed.user ?? null,
        accessToken: parsed.accessToken ?? null,
        refreshToken: parsed.refreshToken ?? null,
      };
    } catch {
      return EMPTY;
    }
  },

  write(data: { user: AuthUser; accessToken: string; refreshToken: string }): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* quota excedida ou modo privado — ignora */
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignora */
    }
  },
};
