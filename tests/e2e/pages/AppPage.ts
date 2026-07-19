import type { Page } from '@playwright/test';
import { SidebarPage } from './SidebarPage';

// aria-label="Alternar tema" confirmado em AppLayout.tsx linha 218
// Avatar do topbar: <a href="/perfil" title="Meu perfil"> — AppLayout.tsx linhas 228-235

export class AppPage {
  readonly sidebar: SidebarPage;

  constructor(private readonly page: Page) {
    this.sidebar = new SidebarPage(page);
  }

  get themeToggle() {
    return this.page.getByRole('button', { name: 'Alternar tema' });
  }

  // Logout real: avatar do topbar → /perfil → botão "Sair da conta" → /login
  // Botão confirmado em pages/Perfil/index.tsx ("Sair da conta" + clearAuth + navigate /login)
  async logout(): Promise<void> {
    await this.page.getByTitle('Meu perfil').click();
    await this.page.waitForURL('/perfil');
    await this.page.getByRole('button', { name: 'Sair da conta' }).click();
    await this.page.waitForURL('/login');
  }
}
