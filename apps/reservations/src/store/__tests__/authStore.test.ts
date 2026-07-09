import { describe, it, expect, beforeEach } from 'vitest';
import {
  useAuthStore,
  selectIsAuthenticated,
  selectUser,
  selectAccessToken,
  selectRefreshToken,
} from '../authStore';

const MOCK_USER = {
  id: 'user-1',
  name: 'Admin SENAI',
  email: 'admin@senai.edu',
  role: 'ADMIN',
};

const MOCK_AUTH = {
  user: MOCK_USER,
  accessToken: 'access-abc',
  refreshToken: 'refresh-xyz',
};

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('estado inicial: sem autenticação', () => {
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.refreshToken).toBeNull();
  });

  it('setAuth: armazena user e ambos os tokens', () => {
    useAuthStore.getState().setAuth(MOCK_AUTH);
    const s = useAuthStore.getState();
    expect(s.user).toEqual(MOCK_USER);
    expect(s.accessToken).toBe('access-abc');
    expect(s.refreshToken).toBe('refresh-xyz');
  });

  it('clearAuth: remove user e tokens', () => {
    useAuthStore.getState().setAuth(MOCK_AUTH);
    useAuthStore.getState().clearAuth();
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.refreshToken).toBeNull();
  });

  it('setAccessToken: atualiza só accessToken sem mexer no resto', () => {
    useAuthStore.getState().setAuth(MOCK_AUTH);
    useAuthStore.getState().setAccessToken('access-novo');
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe('access-novo');
    expect(s.refreshToken).toBe('refresh-xyz');
    expect(s.user).toEqual(MOCK_USER);
  });

  it('selectIsAuthenticated: true quando tem accessToken', () => {
    useAuthStore.getState().setAuth(MOCK_AUTH);
    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(true);
  });

  it('selectIsAuthenticated: false sem accessToken', () => {
    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(false);
  });

  it('selectUser: retorna o usuário autenticado', () => {
    useAuthStore.getState().setAuth(MOCK_AUTH);
    expect(selectUser(useAuthStore.getState())).toEqual(MOCK_USER);
  });

  it('selectAccessToken: retorna o access token', () => {
    useAuthStore.getState().setAuth(MOCK_AUTH);
    expect(selectAccessToken(useAuthStore.getState())).toBe('access-abc');
  });

  it('selectRefreshToken: retorna o refresh token', () => {
    useAuthStore.getState().setAuth(MOCK_AUTH);
    expect(selectRefreshToken(useAuthStore.getState())).toBe('refresh-xyz');
  });
});
