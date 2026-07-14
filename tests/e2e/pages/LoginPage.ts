import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// Seletores confirmados em Login/index.tsx:
//   label htmlFor="lp-email" → "E-mail institucional"
//   label htmlFor="lp-password" → "Senha"
//   button texto "Entrar"
//   p.lp-error role="alert" → "E-mail ou senha inválidos."

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async login(email: string, password: string): Promise<void> {
    await this.page.getByLabel('E-mail institucional').fill(email);
    await this.page.getByLabel('Senha').fill(password);
    await this.page.getByRole('button', { name: 'Entrar' }).click();
  }

  async expectError(text: string): Promise<void> {
    const alert = this.page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(text);
  }

  async expectSubmitDisabled(): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Entrar' })).toBeDisabled();
  }
}
