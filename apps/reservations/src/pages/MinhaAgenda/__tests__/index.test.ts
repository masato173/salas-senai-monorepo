import { describe, it, expect } from 'vitest';
import { proxyBadgeLabel } from '../index';
import type { MyReservation } from '../../../hooks/useMyReservations';

// Mesmo padrão do projeto (ver OccupancyUnified.test.ts) — testa a função
// pura extraída, não renderiza o componente (o projeto não usa
// @testing-library/react em lugar nenhum).

type ReservaMinima = Pick<MyReservation, 'userId' | 'createdByUserId' | 'createdBy'>;

function reserva(overrides: Partial<ReservaMinima>): ReservaMinima {
  return {
    userId: 'prof-1',
    createdByUserId: null,
    createdBy: null,
    ...overrides,
  };
}

describe('proxyBadgeLabel', () => {
  it('retorna null quando createdByUserId é null (reserva normal, sem proxy)', () => {
    expect(proxyBadgeLabel(reserva({ createdByUserId: null }))).toBeNull();
  });

  it('retorna null quando createdByUserId é igual ao userId (não é proxy)', () => {
    expect(
      proxyBadgeLabel(
        reserva({
          userId: 'prof-1',
          createdByUserId: 'prof-1',
          createdBy: { id: 'prof-1', name: 'Prof. Silva' },
        }),
      ),
    ).toBeNull();
  });

  it('retorna "via {nome}" quando createdByUserId difere do userId (proxy real)', () => {
    expect(
      proxyBadgeLabel(
        reserva({
          userId: 'prof-1',
          createdByUserId: 'coord-1',
          createdBy: { id: 'coord-1', name: 'Coord. Ana' },
        }),
      ),
    ).toBe('via Coord. Ana');
  });

  it('usa "—" como fallback quando createdBy não veio no payload (defensivo)', () => {
    expect(
      proxyBadgeLabel(
        reserva({
          userId: 'prof-1',
          createdByUserId: 'coord-1',
          createdBy: null,
        }),
      ),
    ).toBe('via —');
  });
});
