import { test, expect } from './fixtures/test.fixture';
import { LoginPage } from './pages/LoginPage';
import { AppPage } from './pages/AppPage';
import { setupAdminSession, setupProfessorSession } from './helpers/auth';
import { clearAuth } from './fixtures/auth.fixture';

const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'] ?? '';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? '';

test.describe('Autenticação', () => {
  test('login válido com admin redireciona para dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });

  test('login inválido exibe mensagem de erro', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('errado@email.com', 'senhaerrada');
    await loginPage.expectError('E-mail ou senha inválidos');
  });

  test('login com senha vazia mantém botão desabilitado', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail institucional').fill(ADMIN_EMAIL);
    // Senha vazia — botão deve permanecer desabilitado
    const btn = page.getByRole('button', { name: 'Entrar' });
    await expect(btn).toBeDisabled();
  });

  test('login preserva rota original via state.from', async ({ page }) => {
    // Acessa rota protegida sem auth → redireciona para /login preservando state.from
    await page.goto('/reservas');
    await page.waitForURL('/login');
    // Faz login — LoginPage.tsx usa navigate(from, { replace: true })
    const loginPage = new LoginPage(page);
    await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    // Deve retornar para /reservas, não para /
    await page.waitForURL('/reservas');
    await expect(page).toHaveURL('/reservas');
  });

  test('[PROVISÓRIO] logout limpa sessão e redireciona para login', async ({ page }) => {
    // Botão de logout não existe no AppLayout ainda — workaround via clearAuth.
    // TODO: substituir por botão UI quando implementado.
    await setupAdminSession(page);
    await page.goto('/');
    const appPage = new AppPage(page);
    await appPage.logout(); // clearAuth + reload
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });

  test('sessão injetada permite acesso direto sem login via UI', async ({ adminPage }) => {
    // Verifica que injectAuth funciona corretamente
    await adminPage.goto('/');
    // Não deve ter redirecionado para /login
    await expect(adminPage).not.toHaveURL('/login');
  });
});
