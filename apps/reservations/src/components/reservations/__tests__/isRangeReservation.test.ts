import { describe, it, expect } from 'vitest';
import { isRangeReservation } from '../reservationToEvent';

// Regra de dominio (Sprint 4 Fase B):
//   unica  → groupId === id        → false
//   periodo→ groupId !== id e !=='' → true
//   legacy → groupId === ''         → false
//
// Esta funcao eh o ponto unico de verdade da distincao "unica vs grupo".
// O modal usa pra renderizar selo "Periodo"; Fase D vai reusar pra editar.

describe('isRangeReservation()', () => {
  it('retorna false quando reserva unica (groupId === id)', () => {
    expect(isRangeReservation('r-1', 'r-1')).toBe(false);
  });

  it('retorna true quando reserva de periodo (groupId !== id e !== "")', () => {
    expect(isRangeReservation('r-1', 'grp-shared-xyz')).toBe(true);
  });

  it("retorna false quando linha legacy (groupId === '')", () => {
    expect(isRangeReservation('r-legacy-42', '')).toBe(false);
  });
});
