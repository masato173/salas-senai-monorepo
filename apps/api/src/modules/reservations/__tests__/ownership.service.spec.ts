import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Reservation } from '@prisma/client';
import { OwnershipService } from '../ownership.service';
import type { RequestUser } from '../../auth/strategies/jwt.strategy';

// Issue 6 — matriz de posse travada em teste. Regra (ADR-006):
// ADMIN e COORDENADOR modificam QUALQUER reserva (editar, cancelar, aprovar,
// rejeitar — o bypass do COORDENADOR é intencional); o dono modifica a sua;
// qualquer outro recebe ForbiddenException. Inexistente ou soft-deleted →
// NotFoundException em assertCanModify, antes de qualquer checagem de papel.

const mockPrisma = { reservation: { findUnique: vi.fn() } };

function makeService(): OwnershipService {
  return new OwnershipService(mockPrisma as never);
}

const DONO: RequestUser = { userId: 'prof-dono', email: 'dono@senai.edu', role: 'PROFESSOR' };
const OUTRO_PROF: RequestUser = {
  userId: 'prof-outro',
  email: 'outro@senai.edu',
  role: 'PROFESSOR',
};
const COORD: RequestUser = { userId: 'coord-1', email: 'coord@senai.edu', role: 'COORDENADOR' };
const ADMIN: RequestUser = { userId: 'admin-1', email: 'admin@senai.edu', role: 'ADMIN' };

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'res-1',
    userId: 'prof-dono',
    deletedAt: null,
    ...overrides,
  } as Reservation;
}

// Quem pode modificar a reserva de 'prof-dono'.
const MATRIZ: [string, RequestUser, boolean][] = [
  ['dono (própria)', DONO, true],
  ['outro PROFESSOR (alheia)', OUTRO_PROF, false],
  ['COORDENADOR (alheia)', COORD, true],
  ['ADMIN (alheia)', ADMIN, true],
];

describe('OwnershipService.assertOwnerOrPrivileged — matriz de posse (issue 6)', () => {
  it.each(MATRIZ)('%s → permitido=%s', (_label, user, permitido) => {
    const check = () => makeService().assertOwnerOrPrivileged(reservation(), user);
    if (permitido) expect(check).not.toThrow();
    else expect(check).toThrow(ForbiddenException);
  });

  it.each([
    ['COORDENADOR', COORD],
    ['ADMIN', ADMIN],
  ])('%s modifica a própria reserva também', (_label, user) => {
    expect(() =>
      makeService().assertOwnerOrPrivileged(reservation({ userId: user.userId }), user),
    ).not.toThrow();
  });

  it('não consulta o banco (checagem pura)', () => {
    makeService().assertOwnerOrPrivileged(reservation(), DONO);
    expect(mockPrisma.reservation.findUnique).not.toHaveBeenCalled();
  });

  it('reserva soft-deleted: só a permissão é checada (atalho de cancelamento)', () => {
    const cancelada = reservation({ deletedAt: new Date('2026-07-01') });
    expect(() => makeService().assertOwnerOrPrivileged(cancelada, COORD)).not.toThrow();
    expect(() => makeService().assertOwnerOrPrivileged(cancelada, OUTRO_PROF)).toThrow(
      ForbiddenException,
    );
  });
});

describe('OwnershipService.assertCanModify — matriz de posse (issue 6)', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(MATRIZ)('existente, %s → permitido=%s', async (_label, user, permitido) => {
    const r = reservation();
    mockPrisma.reservation.findUnique.mockResolvedValue(r);

    const call = makeService().assertCanModify('res-1', user);
    if (permitido) await expect(call).resolves.toBe(r);
    else await expect(call).rejects.toThrow(ForbiddenException);
  });

  it.each(MATRIZ)('inexistente, %s → NotFoundException', async (_label, user) => {
    mockPrisma.reservation.findUnique.mockResolvedValue(null);

    await expect(makeService().assertCanModify('res-x', user)).rejects.toThrow(NotFoundException);
  });

  it.each(MATRIZ)('soft-deleted, %s → NotFoundException', async (_label, user) => {
    mockPrisma.reservation.findUnique.mockResolvedValue(
      reservation({ deletedAt: new Date('2026-07-01') }),
    );

    await expect(makeService().assertCanModify('res-1', user)).rejects.toThrow(NotFoundException);
  });
});
