import { describe, it, expect } from 'vitest';
import { validateReservation } from '../reservation';

describe('validateReservation()', () => {
  const valid = {
    roomId:  'sala-603',
    userId:  'user-abc',
    date:    '2026-06-15',
    start:   '07:30',
    end:     '09:30',
    turno:   'M' as const,
    reason:  'Aula de ADM',
  };

  it('aceita reserva válida', () => {
    expect(validateReservation(valid).ok).toBe(true);
  });

  it('rejeita sem roomId', () => {
    const r = validateReservation({ ...valid, roomId: '' });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('roomId é obrigatório');
  });

  it('rejeita sem userId', () => {
    const r = validateReservation({ ...valid, userId: '' });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('userId é obrigatório');
  });

  it('rejeita turno inválido', () => {
    const r = validateReservation({ ...valid, turno: 'X' as any });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('turno deve ser M, V ou N');
  });

  it('rejeita reason com XSS', () => {
    const r = validateReservation({ ...valid, reason: '<script>alert(1)</script>' });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('reason contém caracteres inválidos');
  });

  it('rejeita reason muito longa', () => {
    const r = validateReservation({ ...valid, reason: 'a'.repeat(201) });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('reason deve ter no máximo 200 caracteres');
  });

  it('acumula múltiplos erros', () => {
    const r = validateReservation({ ...valid, roomId: '', userId: '', turno: 'X' as any });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
});
