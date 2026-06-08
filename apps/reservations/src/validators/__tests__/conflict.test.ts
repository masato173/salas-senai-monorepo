import { describe, it, expect } from 'vitest';
import { hasConflict, validateTimeInput, isValidDate } from '../conflict';

// ─────────────────────────────────────────────────────────────
// hasConflict — não muda: fórmula de sobreposição é a mesma
// ─────────────────────────────────────────────────────────────
describe('hasConflict()', () => {
  it('detecta sobreposição total', () => {
    expect(hasConflict({ start: '07:30', end: '09:30' }, { start: '07:30', end: '09:30' })).toBe(true);
  });

  it('detecta sobreposição parcial início', () => {
    expect(hasConflict({ start: '07:30', end: '09:30' }, { start: '08:00', end: '10:00' })).toBe(true);
  });

  it('detecta sobreposição parcial fim', () => {
    expect(hasConflict({ start: '09:00', end: '11:00' }, { start: '07:30', end: '10:00' })).toBe(true);
  });

  it('detecta sobreposição contida', () => {
    expect(hasConflict({ start: '07:30', end: '11:45' }, { start: '08:00', end: '09:00' })).toBe(true);
  });

  it('NÃO conflita quando adjacentes (fim == início)', () => {
    expect(hasConflict({ start: '07:30', end: '09:30' }, { start: '09:30', end: '11:30' })).toBe(false);
  });

  it('NÃO conflita quando horários separados', () => {
    expect(hasConflict({ start: '07:30', end: '09:30' }, { start: '13:30', end: '15:30' })).toBe(false);
  });

  it('detecta race condition (mesmo horário exato)', () => {
    const slot = { start: '13:30', end: '15:30' };
    expect(hasConflict(slot, slot)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// validateTimeInput — novo: valida horário livre (não mais oficial)
// ─────────────────────────────────────────────────────────────
describe('validateTimeInput()', () => {
  it('aceita horário válido HH:MM', () => {
    expect(validateTimeInput({ start: '08:00', end: '10:00', date: '2099-12-31' }).ok).toBe(true);
  });

  it('rejeita start igual a end', () => {
    const r = validateTimeInput({ start: '08:00', end: '08:00', date: '2099-12-31' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/fim deve ser após/i);
  });

  it('rejeita end antes de start', () => {
    const r = validateTimeInput({ start: '10:00', end: '08:00', date: '2099-12-31' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/fim deve ser após/i);
  });

  it('rejeita duração menor que 30 minutos', () => {
    const r = validateTimeInput({ start: '08:00', end: '08:20', date: '2099-12-31' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/m[íi]nima.*30 minutos/i);
  });

  it('aceita exatamente 30 minutos', () => {
    expect(validateTimeInput({ start: '08:00', end: '08:30', date: '2099-12-31' }).ok).toBe(true);
  });

  it('rejeita duração maior que 4 horas', () => {
    const r = validateTimeInput({ start: '07:00', end: '12:00', date: '2099-12-31' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/m[áa]xima.*4 horas/i);
  });

  it('aceita exatamente 4 horas', () => {
    expect(validateTimeInput({ start: '07:00', end: '11:00', date: '2099-12-31' }).ok).toBe(true);
  });

  it('rejeita formato inválido HH:MM', () => {
    const r = validateTimeInput({ start: '25:00', end: '26:00', date: '2099-12-31' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/formato inválido/i);
  });

  it('rejeita string vazia', () => {
    const r = validateTimeInput({ start: '', end: '10:00', date: '2099-12-31' });
    expect(r.ok).toBe(false);
  });

  it('rejeita data no passado', () => {
    const r = validateTimeInput({ start: '08:00', end: '10:00', date: '2000-01-01' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/passado/i);
  });

  it('rejeita data inválida', () => {
    const r = validateTimeInput({ start: '08:00', end: '10:00', date: 'nao-e-data' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/data inválida/i);
  });
});

// ─────────────────────────────────────────────────────────────
// isValidDate — não muda
// ─────────────────────────────────────────────────────────────
describe('isValidDate()', () => {
  it('aceita YYYY-MM-DD', () => expect(isValidDate('2026-06-15')).toBe(true));
  it('rejeita DD/MM/YYYY',  () => expect(isValidDate('15/06/2026')).toBe(false));
  it('rejeita vazia',       () => expect(isValidDate('')).toBe(false));
  it('rejeita data impossível', () => expect(isValidDate('2026-13-01')).toBe(false));
});
