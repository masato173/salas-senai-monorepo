import { test as base, expect, type Page } from '@playwright/test';
import { loginViaApi, injectAuth } from './auth.fixture';

const API_URL = process.env['API_URL'] ?? 'http://localhost:3000';

interface AuthFixtures {
  adminPage: Page;
  professorPage: Page;
}

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ page }, use) => {
    const auth = await loginViaApi(
      API_URL,
      process.env['E2E_ADMIN_EMAIL'] ?? '',
      process.env['E2E_ADMIN_PASSWORD'] ?? '',
    );
    await injectAuth(page, auth);
    await use(page);
  },
  professorPage: async ({ page }, use) => {
    const auth = await loginViaApi(
      API_URL,
      process.env['E2E_PROFESSOR_EMAIL'] ?? '',
      process.env['E2E_PROFESSOR_PASSWORD'] ?? '',
    );
    await injectAuth(page, auth);
    await use(page);
  },
});

export { expect };
