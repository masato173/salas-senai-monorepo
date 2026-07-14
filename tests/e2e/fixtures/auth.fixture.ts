import type { Page } from '@playwright/test';

// Tipos espelhados de authStore.ts — não importa código do app.
interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// Chave real do tokenStorage.ts do app.
const STORAGE_KEY = 'senai-auth-v1';

export async function loginViaApi(
  apiUrl: string,
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`[auth] login failed: ${res.status}`);
  return res.json() as Promise<LoginResponse>;
}

// addInitScript garante que Zustand encontre os dados no mount inicial.
// Deve ser chamado ANTES de page.goto() para ter efeito.
export async function injectAuth(page: Page, auth: LoginResponse): Promise<void> {
  await page.addInitScript(
    ({ key, data }) => {
      localStorage.setItem(key, JSON.stringify(data));
    },
    {
      key: STORAGE_KEY,
      data: {
        user: auth.user,
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
      },
    },
  );
}

export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate(key => localStorage.removeItem(key), STORAGE_KEY);
}
