import { describe, it, expect } from 'vitest';
import { groupReservations } from '../ReservationList';
import type { CreatedReservationRow } from '../../../services/apiTypes';

// Nota: o projeto não usa @testing-library/react — este teste cobre a
// função pura extraída de ReservationList.tsx (groupReservations), não o
// output visual do componente. Mesmo padrão de OccupancyUnified.test.ts.

function row(overrides: Partial<CreatedReservationRow> = {}): CreatedReservationRow {
  return {
    id: 'r1',
    sala: '603 Sala',
    data: '2026-08-10',
    inicio: '08:00',
    fim: '10:00',
    professor: 'Prof. Silva',
    turma: 'APB.ADM.148',
    observacao: '',
    status: 'APPROVED',
    createdBy: 'professor@senai.edu',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('groupReservations', () => {
  it('mostra PENDING e APPROVED, esconde REJECTED e CANCELLED', () => {
    const reservations = [
      row({ id: 'p1', status: 'PENDING', inicio: '08:00' }),
      row({ id: 'a1', status: 'APPROVED', inicio: '14:00' }),
      row({ id: 'r1', status: 'REJECTED', inicio: '19:00' }),
      row({ id: 'c1', status: 'CANCELLED', inicio: '09:00' }),
    ];

    const grouped = groupReservations(reservations);
    const ids = grouped.flatMap(g => g.items.map(i => i.id));

    expect(ids).toEqual(['p1', 'a1']);
    expect(ids).not.toContain('r1');
    expect(ids).not.toContain('c1');
  });

  it('agrupa por turno (M/V/N) inferido do horário de início', () => {
    const reservations = [
      row({ id: 'manha', status: 'APPROVED', inicio: '08:00' }),
      row({ id: 'tarde', status: 'PENDING', inicio: '14:00' }),
      row({ id: 'noite', status: 'APPROVED', inicio: '19:00' }),
    ];

    const grouped = groupReservations(reservations);

    expect(grouped.map(g => g.turno)).toEqual(['M', 'V', 'N']);
    expect(grouped.find(g => g.turno === 'M')?.items.map(i => i.id)).toEqual(['manha']);
    expect(grouped.find(g => g.turno === 'V')?.items.map(i => i.id)).toEqual(['tarde']);
    expect(grouped.find(g => g.turno === 'N')?.items.map(i => i.id)).toEqual(['noite']);
  });

  it('filtra por userId quando informado (createdBy)', () => {
    const reservations = [
      row({ id: 'meu', status: 'APPROVED', createdBy: 'professor@senai.edu' }),
      row({ id: 'de-outro', status: 'APPROVED', createdBy: 'outro@senai.edu' }),
    ];

    const grouped = groupReservations(reservations, 'professor@senai.edu');
    const ids = grouped.flatMap(g => g.items.map(i => i.id));

    expect(ids).toEqual(['meu']);
  });

  it('sem userId, não filtra por dono', () => {
    const reservations = [
      row({ id: 'a', status: 'APPROVED', createdBy: 'a@senai.edu' }),
      row({ id: 'b', status: 'PENDING', createdBy: 'b@senai.edu' }),
    ];

    const grouped = groupReservations(reservations, undefined);
    const ids = grouped.flatMap(g => g.items.map(i => i.id));

    expect(ids.sort()).toEqual(['a', 'b']);
  });

  it('lista vazia quando reservations é undefined', () => {
    expect(groupReservations(undefined)).toEqual([]);
  });
});
