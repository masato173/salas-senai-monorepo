import { describe, it, expect } from 'vitest';
import { detectConflicts } from '../useConflict';
import type { Reservation } from '../../types';

const existing: Reservation[] = [
  { id: '1', roomId: 'sala-603', date: '2026-06-15', start: '07:30', end: '09:30', turno: 'M', status: 'APPROVED', userId: 'u1', reason: 'Aula' },
  { id: '2', roomId: 'sala-603', date: '2026-06-15', start: '13:30', end: '15:30', turno: 'V', status: 'APPROVED', userId: 'u2', reason: 'Lab' },
  { id: '3', roomId: 'sala-607', date: '2026-06-15', start: '07:30', end: '09:30', turno: 'M', status: 'APPROVED', userId: 'u3', reason: 'Aula' },
];

describe('detectConflicts()', () => {
  it('detecta conflito na mesma sala e horário', () => {
    const conflicts = detectConflicts(existing, {
      roomId: 'sala-603', date: '2026-06-15', start: '07:30', end: '09:30',
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe('1');
  });

  it('não detecta conflito em sala diferente', () => {
    const conflicts = detectConflicts(existing, {
      roomId: 'sala-999', date: '2026-06-15', start: '07:30', end: '09:30',
    });
    expect(conflicts).toHaveLength(0);
  });

  it('não detecta conflito em data diferente', () => {
    const conflicts = detectConflicts(existing, {
      roomId: 'sala-603', date: '2026-06-16', start: '07:30', end: '09:30',
    });
    expect(conflicts).toHaveLength(0);
  });

  it('não detecta conflito em horário adjacente', () => {
    const conflicts = detectConflicts(existing, {
      roomId: 'sala-603', date: '2026-06-15', start: '09:45', end: '11:45',
    });
    expect(conflicts).toHaveLength(0);
  });

  it('exclui reserva editada da verificação (excludeId)', () => {
    const conflicts = detectConflicts(existing, {
      roomId: 'sala-603', date: '2026-06-15', start: '07:30', end: '09:30',
    }, '1');
    expect(conflicts).toHaveLength(0);
  });

  it('ignora reservas canceladas/rejeitadas', () => {
    const withCancelled: Reservation[] = [
      ...existing,
      { id: '99', roomId: 'sala-603', date: '2026-06-15', start: '07:30', end: '09:30', turno: 'M', status: 'CANCELLED', userId: 'u9', reason: '' },
    ];
    const conflicts = detectConflicts(withCancelled, {
      roomId: 'sala-603', date: '2026-06-15', start: '08:00', end: '09:00',
    });
    // Só deve detectar a reserva APPROVED id='1', não a CANCELLED
    expect(conflicts.every(c => c.status !== 'CANCELLED')).toBe(true);
  });
});
