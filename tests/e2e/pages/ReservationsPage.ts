import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// Seletores baseados em componentes existentes:
// ReservationList.tsx, ReservationForm.tsx, ReservationDetailsModal.tsx
// Prioridade: getByRole > getByLabel > getByText > data-testid

export class ReservationsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/reservas');
    await this.page.waitForLoadState('networkidle');
  }

  async expectPageVisible(): Promise<void> {
    // Aguarda qualquer elemento característico da página de reservas
    await expect(this.page.getByRole('heading', { name: /reserva/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  }

  async expectListLoaded(): Promise<void> {
    // Aguarda que o skeleton desapareça e os dados carreguem
    // A página tem loading state — aguardar até não ter mais skeleton
    await this.page.waitForLoadState('networkidle');
  }

  // Abre o formulário de nova reserva
  async openNewReservationForm(): Promise<void> {
    await this.page.getByRole('button', { name: /nova reserva/i }).click();
  }

  // Verifica se há pelo menos uma reserva na lista
  async expectAtLeastOneReservation(): Promise<void> {
    // Reservas renderizadas como items — aguardar pelo menos um
    await expect(this.page.locator('[class*="reservation"]').first()).toBeVisible({
      timeout: 15_000,
    });
  }
}
