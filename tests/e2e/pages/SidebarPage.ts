import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// aria-label="Navegação principal" confirmado em AppLayout.tsx linha 138
// Seção admin: label "Admin" (SECTION_LABELS em AppLayout.tsx), renderizada só para role ADMIN.
// exact: true é obrigatório — sem ele, getByText('Admin') também casa os links
// "Dashboard Admin" e "Configurações Admin" (strict mode violation).

export class SidebarPage {
  constructor(private readonly page: Page) {}

  private get nav() {
    return this.page.getByRole('navigation', { name: 'Navegação principal' });
  }

  link(label: string) {
    return this.nav.getByRole('link', { name: label });
  }

  async navigateTo(label: string): Promise<void> {
    await this.link(label).click();
  }

  async expectAdminSectionVisible(): Promise<void> {
    await expect(this.nav.getByText('Admin', { exact: true })).toBeVisible();
  }

  async expectAdminSectionHidden(): Promise<void> {
    await expect(this.nav.getByText('Admin', { exact: true })).not.toBeVisible();
  }
}
