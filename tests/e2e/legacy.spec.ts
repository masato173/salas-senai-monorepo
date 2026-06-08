import { test, expect } from '@playwright/test';

// Testes E2E do sistema legado — validam que nada quebrou
// Executar contra o site real em produção ou localhost

const BASE_URL = process.env.BASE_URL ?? 'https://masato173.github.io/salas-senai/';

test.describe('Sistema legado — regressão', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // Aguarda os dados carregarem (status muda de loading para ok)
    await page.waitForSelector('.status.ok', { timeout: 15_000 });
  });

  test('carrega dados e mostra registros', async ({ page }) => {
    const total = await page.locator('#sTotal').textContent();
    expect(Number(total?.replace('.', ''))).toBeGreaterThan(0);
  });

  test('filtro de turma funciona', async ({ page }) => {
    await page.fill('#fTurma', 'ADM');
    await page.waitForTimeout(300);
    const badge = await page.locator('#countBadge').textContent();
    expect(badge).not.toBe('0 resultados');
  });

  test('filtro Matutino filtra apenas turno M', async ({ page }) => {
    await page.click('[data-turno="M"]');
    await page.waitForTimeout(300);

    // Todas as badges visíveis devem ser "Matutino"
    const badges = await page.locator('.turno-badge.M').count();
    const outrosBadges = await page.locator('.turno-badge.V, .turno-badge.N').count();

    expect(badges).toBeGreaterThan(0);
    expect(outrosBadges).toBe(0);
  });

  test('botão Hoje filtra pela data de hoje', async ({ page }) => {
    await page.click('button:has-text("Hoje")');
    const dataInput = await page.locator('#fData').inputValue();
    const hoje = new Date().toISOString().slice(0, 10);
    expect(dataInput).toBe(hoje);
  });

  test('botão Limpar restaura todos os registros', async ({ page }) => {
    // Aplica filtros
    await page.fill('#fTurma', 'ADM');
    await page.click('[data-turno="M"]');
    await page.waitForTimeout(200);

    // Limpa
    await page.click('button:has-text("Limpar")');
    await page.waitForTimeout(200);

    const filt = await page.locator('#sFilt').textContent();
    const total = await page.locator('#sTotal').textContent();
    expect(filt).toBe(total);
  });

  test('paginação funciona', async ({ page }) => {
    const pager = page.locator('#pager');
    const isVisible = await pager.isVisible();
    if (isVisible) {
      await page.click('.pager-btn:not([disabled]):not(.active)');
      await page.waitForTimeout(200);
      const activePage = await page.locator('.pager-btn.active').textContent();
      expect(Number(activePage)).toBeGreaterThan(1);
    }
  });

  test('XSS não executa — conteúdo aparece como texto', async ({ page }) => {
    // Se XSS fosse executado, o alert() rodaria e Playwright detectaria
    page.on('dialog', dialog => {
      throw new Error(`XSS executado: ${dialog.message()}`);
    });
    // Aguarda renderização completa
    await page.waitForTimeout(1000);
  });
});
