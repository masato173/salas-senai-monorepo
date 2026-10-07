import type { Page } from '@playwright/test';
import { loginViaApi, injectAuth } from '../fixtures/auth.fixture';
import type { LoginResponse } from '../fixtures/auth.fixture';
import { requireEnv } from './env';

const API_URL = process.env['API_URL'] ?? 'http://localhost:3000';

export async function setupAdminSession(page: Page): Promise<LoginResponse> {
  const auth = await loginViaApi(
    API_URL,
    process.env['E2E_ADMIN_EMAIL'] ?? '',
    requireEnv('E2E_ADMIN_PASSWORD'),
  );
  await injectAuth(page, auth);
  return auth;
}

export async function setupProfessorSession(page: Page): Promise<LoginResponse | null> {
  try {
    const auth = await loginViaApi(
      API_URL,
      process.env['E2E_PROFESSOR_EMAIL'] ?? '',
      requireEnv('E2E_PROFESSOR_PASSWORD'),
    );
    await injectAuth(page, auth);
    return auth;
  } catch {
    // Professor de teste pode não existir no banco.
    // Specs que dependem devem chamar test.skip() se retorno for null.
    return null;
  }
}

export async function setupCoordenadorSession(page: Page): Promise<LoginResponse | null> {
  try {
    const auth = await loginViaApi(
      API_URL,
      process.env['E2E_COORDENADOR_EMAIL'] ?? '',
      requireEnv('E2E_COORDENADOR_PASSWORD'),
    );
    await injectAuth(page, auth);
    return auth;
  } catch {
    // Coordenador de teste pode não existir no banco.
    // Specs que dependem devem chamar test.skip() se retorno for null.
    return null;
  }
}
