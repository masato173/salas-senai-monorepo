import { describe, it, expect } from 'vitest';
import { esc } from '../esc';

// TDD: estes testes foram escritos ANTES da implementação
// RED → GREEN → REFACTOR

describe('esc()', () => {
  it('escapa < e >', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;');
  });

  it('escapa & antes de qualquer coisa', () => {
    expect(esc('a & b')).toBe('a &amp; b');
    // Se & não for escapado primeiro, "a & b" → "a &amp; b" correto
    // Se & for escapado depois, "&lt;" → "&amp;lt;" errado
  });

  it('escapa aspas duplas', () => {
    expect(esc('"value"')).toBe('&quot;value&quot;');
  });

  it('escapa aspas simples', () => {
    expect(esc("it's")).toBe("it&#x27;s");
  });

  it('não altera texto simples', () => {
    expect(esc('APB.OPL.099')).toBe('APB.OPL.099');
  });

  it('converte não-string para string', () => {
    expect(esc(null as unknown as string)).toBe('null');
    expect(esc(123 as unknown as string)).toBe('123');
  });

  it('payload XSS completo não executa', () => {
    const payload = '<img src=x onerror="alert(1)">';
    const result  = esc(payload);
    expect(result).not.toContain('<img');
    expect(result).not.toContain('onerror');
    expect(result).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it('string vazia retorna string vazia', () => {
    expect(esc('')).toBe('');
  });
});
