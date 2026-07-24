import { test, expect } from './fixtures/test.fixture';
import { setupAdminSession, setupProfessorSession } from './helpers/auth';
import { SidebarPage } from './pages/SidebarPage';

test.describe('Navegação e proteção de rotas', () => {
  test.describe('Sem autenticação', () => {
    test('rota protegida /reservas redireciona para /login', async ({ page }) => {
      await page.goto('/reservas');
      await page.waitForURL('/login');
      await expect(page).toHaveURL('/login');
    });

    test('rota admin /admin redireciona para /login', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForURL('/login');
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Role insuficiente (PROFESSOR)', () => {
    test('acesso a /admin redireciona para / — não para /login', async ({ page }) => {
      // ProtectedRoute: role insuficiente → Navigate to="/" (não para /login)
      // Descoberta crítica do plano: PROFESSOR vai para /, ADMIN vai para /admin
      const auth = await setupProfessorSession(page);
      if (auth === null) {
        test.skip();
        return;
      }
      await page.goto('/admin');
      // Deve ir para /, não para /login
      await page.waitForURL('/');
      await expect(page).toHaveURL('/');
      await expect(page).not.toHaveURL('/login');
    });

    test('sidebar não exibe seção Admin para PROFESSOR', async ({ page }) => {
      const auth = await setupProfessorSession(page);
      if (auth === null) {
        test.skip();
        return;
      }
      await page.goto('/');
      const sidebar = new SidebarPage(page);
      await sidebar.expectAdminSectionHidden();
    });
  });

  test.describe('PROFESSOR', () => {
    test('PROFESSOR acessa /minha-agenda sem redirect', async ({ page }) => {
      // /minha-agenda: requiresAuth true, sem requiredRole (router/config.ts)
      // — qualquer role autenticada deve carregar sem redirect.
      const auth = await setupProfessorSession(page);
      if (auth === null) {
        test.skip();
        return;
      }
      await page.goto('/minha-agenda');
      await expect(page).not.toHaveURL('/login');
      await expect(page).toHaveURL('/minha-agenda');
    });
  });

  test.describe('ADMIN', () => {
    test('sidebar exibe seção Admin para ADMIN', async ({ adminPage }) => {
      await adminPage.goto('/');
      const sidebar = new SidebarPage(adminPage);
      await sidebar.expectAdminSectionVisible();
    });

    test('ADMIN acessa /admin sem redirect', async ({ adminPage }) => {
      await adminPage.goto('/admin');
      await expect(adminPage).not.toHaveURL('/login');
      await expect(adminPage).not.toHaveURL('/');
      await expect(adminPage).toHaveURL('/admin');
    });

    test('ADMIN acessa /admin/usuarios sem redirect', async ({ adminPage }) => {
      await adminPage.goto('/admin/usuarios');
      await expect(adminPage).not.toHaveURL('/login');
      await expect(adminPage).toHaveURL('/admin/usuarios');
    });

    test('ADMIN acessa /admin/auditoria sem redirect', async ({ adminPage }) => {
      await adminPage.goto('/admin/auditoria');
      await expect(adminPage).not.toHaveURL('/login');
      await expect(adminPage).toHaveURL('/admin/auditoria');
    });
  });
});
