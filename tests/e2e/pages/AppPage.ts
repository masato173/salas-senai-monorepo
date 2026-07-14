import type { Page } from '@playwright/test';
import { SidebarPage } from './SidebarPage';
import { clearAuth } from '../fixtures/auth.fixture';

// aria-label="Alternar tema" confirmado em AppLayout.tsx linha 218
// Botão de logout não existe no AppLayout atual — clearAuth é o workaround.

export class AppPage {
  readonly sidebar: SidebarPage;

  constructor(private readonly page: Page) {
    this.sidebar = new SidebarPage(page);
  }

  get themeToggle() {
    return this.page.getByRole('button', { name: 'Alternar tema' });
  }

  // [PROVISÓRIO] Simula logout via localStorage.clear().
  // TODO: substituir por page.getByRole('button', { name: 'Sair' }).click()
  //       quando botão de logout for implementado no AppLayout.tsx.
  async logout(): Promise<void> {
    await clearAuth(this.page);
    await this.page.reload();
  }
}
