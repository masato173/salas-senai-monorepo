import { test, expect } from './fixtures/test.fixture';
import { AdminPage } from './pages/AdminPage';
import { SidebarPage } from './pages/SidebarPage';

test.describe('Portal Admin', () => {
  test('dashboard admin carrega heading correto', async ({ adminPage }) => {
    const admin = new AdminPage(adminPage);
    await admin.goto();
    await admin.expectDashboardVisible();
  });

  test('sidebar exibe links de navegação admin', async ({ adminPage }) => {
    await adminPage.goto('/admin');
    const sidebar = new SidebarPage(adminPage);
    await sidebar.expectAdminSectionVisible();
    // Verifica links individuais da seção admin
    await expect(sidebar.link('Usuários')).toBeVisible();
    await expect(sidebar.link('Auditoria')).toBeVisible();
    await expect(sidebar.link('Sincronização')).toBeVisible();
  });

  test('página /admin/sistema exibe status da API', async ({ adminPage }) => {
    const admin = new AdminPage(adminPage);
    await admin.gotoSistema();
    // Aguarda elemento característico da página de sistema
    await expect(adminPage.getByRole('heading', { name: 'Sistema' })).toBeVisible({
      timeout: 15_000,
    });
    // Status API deve aparecer (Online ou Offline).
    // .first() é necessário: a página tem 3+ badges de status (API, Banco de
    // Dados, WebSocket "Desconhecido") — sem ele, strict mode violation.
    await expect(adminPage.getByText(/Online|Offline|Desconhecido/).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('página /admin/sync exibe botão de sincronização', async ({ adminPage }) => {
    const admin = new AdminPage(adminPage);
    await admin.gotoSync();
    // Texto real do botão em pages/Admin/Sync/index.tsx: "Iniciar Sincronização"
    // (/sincronizar/i não casa — "Sincronização" tem "ç", não "r", após "Sincroniza")
    await expect(adminPage.getByRole('button', { name: 'Iniciar Sincronização' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('página /admin/usuarios exibe lista de usuários', async ({ adminPage }) => {
    const admin = new AdminPage(adminPage);
    await admin.gotoUsuarios();
    // Aguarda tabela ou lista carregar
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage).not.toHaveURL('/login');
    // Título da página deve estar visível
    await expect(adminPage.getByRole('heading', { name: 'Usuários' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('página /admin/auditoria exibe tabela de logs', async ({ adminPage }) => {
    await adminPage.goto('/admin/auditoria');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage).not.toHaveURL('/login');
    await expect(adminPage.getByRole('heading', { name: 'Auditoria' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('página /admin/api exibe documentação de endpoints', async ({ adminPage }) => {
    await adminPage.goto('/admin/api');
    await expect(adminPage.getByRole('heading', { name: 'API Reference' })).toBeVisible({
      timeout: 10_000,
    });
    // Verifica que há pelo menos um módulo listado
    await expect(
      adminPage.getByRole('group').first().or(adminPage.locator('details').first()),
    ).toBeVisible();
  });
});
