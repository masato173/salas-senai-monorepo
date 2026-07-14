import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SidebarPage } from './SidebarPage';

export class AdminPage {
  readonly sidebar: SidebarPage;

  constructor(private readonly page: Page) {
    this.sidebar = new SidebarPage(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoSync(): Promise<void> {
    await this.page.goto('/admin/sync');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoSistema(): Promise<void> {
    await this.page.goto('/admin/sistema');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoUsuarios(): Promise<void> {
    await this.page.goto('/admin/usuarios');
    await this.page.waitForLoadState('networkidle');
  }

  async expectDashboardVisible(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Dashboard Admin' })).toBeVisible();
  }
}
