import { describe, it, expect, afterEach } from 'vitest';
import { resolveCorsOrigins } from '../cors-origins.util';

describe('resolveCorsOrigins', () => {
  const original = process.env['CORS_ORIGIN'];

  afterEach(() => {
    if (original === undefined) {
      delete process.env['CORS_ORIGIN'];
    } else {
      process.env['CORS_ORIGIN'] = original;
    }
  });

  it('sem CORS_ORIGIN definida — usa o fallback de localhost (5173 + 4173)', () => {
    delete process.env['CORS_ORIGIN'];
    expect(resolveCorsOrigins()).toEqual(['http://localhost:5173', 'http://localhost:4173']);
  });

  it('com CORS_ORIGIN definida — faz split por vírgula e trim de cada origem', () => {
    process.env['CORS_ORIGIN'] = 'https://app.exemplo.com, https://outra.exemplo.com';
    expect(resolveCorsOrigins()).toEqual(['https://app.exemplo.com', 'https://outra.exemplo.com']);
  });

  it('com CORS_ORIGIN de uma única origem — retorna array de 1 elemento', () => {
    process.env['CORS_ORIGIN'] = 'https://app.exemplo.com';
    expect(resolveCorsOrigins()).toEqual(['https://app.exemplo.com']);
  });
});
