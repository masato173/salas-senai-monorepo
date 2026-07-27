import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '../NotificationBell';

// Função pura extraída — testável sem renderizar (o projeto não usa
// @testing-library/react em lugar nenhum).

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-10T12:00:00Z');

  it('retorna "agora" pra menos de 1 minuto', () => {
    expect(formatRelativeTime('2026-08-10T11:59:30Z', now)).toBe('agora');
  });

  it('retorna minutos pra menos de 1 hora', () => {
    expect(formatRelativeTime('2026-08-10T11:45:00Z', now)).toBe('15 min');
  });

  it('retorna horas pra menos de 24h', () => {
    expect(formatRelativeTime('2026-08-10T09:00:00Z', now)).toBe('3h');
  });

  it('retorna dias pra menos de 7 dias', () => {
    expect(formatRelativeTime('2026-08-08T12:00:00Z', now)).toBe('2d');
  });

  it('retorna data curta (DD/MM) pra 7 dias ou mais', () => {
    expect(formatRelativeTime('2026-08-01T12:00:00Z', now)).toBe('01/08');
  });
});
