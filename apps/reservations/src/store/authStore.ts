import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { tokenStorage } from '../services/tokenStorage';

// ─────────────────────────────────────────────────────────────
// AuthStep — union preparada para crescer sem refatoração.
// F5.1: apenas 'credentials' ativo.
// F5.x: 'mfa', 'forgot-password', 'reset-password', 'success'
//        serão implementados adicionando renderXxx() na LoginPage.
// ─────────────────────────────────────────────────────────────
export type AuthStep = 'credentials' | 'mfa' | 'forgot-password' | 'reset-password' | 'success';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthActions {
  // Chamado após login bem-sucedido
  setAuth: (params: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  // Chamado pelo ApiClient (F5.2) após refresh token rotation
  setAccessToken: (accessToken: string) => void;
  // Chamado no logout ou em 401 irrecuperável
  clearAuth: () => void;
}

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  devtools(
    set => ({
      // Leitura síncrona do tokenStorage → sem flash de redirect no page refresh
      ...tokenStorage.read(),

      setAuth({ user, accessToken, refreshToken }) {
        tokenStorage.write({ user, accessToken, refreshToken });
        set({ user, accessToken, refreshToken });
      },

      setAccessToken(accessToken) {
        set(state => {
          if (state.user !== null && state.refreshToken !== null) {
            tokenStorage.write({ user: state.user, accessToken, refreshToken: state.refreshToken });
          }
          return { accessToken };
        });
      },

      clearAuth() {
        tokenStorage.clear();
        set({ user: null, accessToken: null, refreshToken: null });
      },
    }),
    { name: 'auth-store' },
  ),
);

// Selectors — usados em ProtectedRoute, AppLayout, ApiClient (F5.2)
export const selectIsAuthenticated = (s: AuthStore): boolean => s.accessToken !== null;
export const selectUser = (s: AuthStore): AuthUser | null => s.user;
export const selectAccessToken = (s: AuthStore): string | null => s.accessToken;
export const selectRefreshToken = (s: AuthStore): string | null => s.refreshToken;
