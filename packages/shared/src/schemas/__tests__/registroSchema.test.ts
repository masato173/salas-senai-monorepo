import { describe, it, expect } from 'vitest';
import { registroSchema, turnoMapSchema, apiResponseSchema } from '../registroSchema';

// ── TDD RED: schemas não existem ainda ──────────────────────

describe('registroSchema', () => {
  it('aceita registro válido completo', () => {
    const result = registroSchema.safeParse({
      data: '2026-01-12', sala: '603 Sala',
      turma: 'APB.OPL.015', mes: 'Janeiro',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita data em formato inválido', () => {
    const result = registroSchema.safeParse({
      data: 'not-a-date', sala: '603 Sala',
      turma: 'APB.OPL.015', mes: 'Janeiro',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita data vazia', () => {
    const result = registroSchema.safeParse({
      data: '', sala: '603 Sala',
      turma: 'APB.OPL.015', mes: 'Janeiro',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita turma vazia', () => {
    const result = registroSchema.safeParse({
      data: '2026-01-12', sala: '603 Sala',
      turma: '', mes: 'Janeiro',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita sala vazia', () => {
    const result = registroSchema.safeParse({
      data: '2026-01-12', sala: '',
      turma: 'APB.OPL.015', mes: 'Janeiro',
    });
    expect(result.success).toBe(false);
  });

  it('aceita turma com barra (célula múltipla)', () => {
    const result = registroSchema.safeParse({
      data: '2026-01-12', sala: '607 Sala',
      turma: 'APB.OPL.123/OPL.124', mes: 'Fevereiro',
    });
    expect(result.success).toBe(true);
  });

  it('faz trim em strings', () => {
    const result = registroSchema.safeParse({
      data: '2026-01-12', sala: ' 603 Sala ',
      turma: ' APB.OPL.015 ', mes: ' Janeiro ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.turma).toBe('APB.OPL.015');
      expect(result.data.sala).toBe('603 Sala');
      expect(result.data.mes).toBe('Janeiro');
    }
  });

  it('rejeita campos ausentes', () => {
    expect(registroSchema.safeParse({}).success).toBe(false);
    expect(registroSchema.safeParse({ data: '2026-01-12' }).success).toBe(false);
  });
});

describe('turnoMapSchema', () => {
  it('aceita mapa válido', () => {
    const result = turnoMapSchema.safeParse({
      'APB.OPL.015': 'V',
      'APB.ADM.148': 'M',
      'APB.OPL.097': 'N',
    });
    expect(result.success).toBe(true);
  });

  it('aceita mapa vazio', () => {
    expect(turnoMapSchema.safeParse({}).success).toBe(true);
  });

  it('rejeita turno inválido', () => {
    const result = turnoMapSchema.safeParse({ 'APB.OPL.015': 'X' });
    expect(result.success).toBe(false);
  });

  it('rejeita turno minúsculo', () => {
    const result = turnoMapSchema.safeParse({ 'APB.OPL.015': 'm' });
    expect(result.success).toBe(false);
  });
});

describe('apiResponseSchema', () => {
  it('aceita resposta completa válida', () => {
    const result = apiResponseSchema.safeParse({
      ok: true, total: 2,
      dados: [
        { data: '2026-01-12', sala: '603 Sala', turma: 'APB.OPL.015', mes: 'Janeiro' },
      ],
      turnoMap: { 'APB.OPL.015': 'V' },
    });
    expect(result.success).toBe(true);
  });

  it('usa defaults para campos ausentes (dados e turnoMap)', () => {
    const result = apiResponseSchema.safeParse({ ok: true, total: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dados).toEqual([]);
      expect(result.data.turnoMap).toEqual({});
    }
  });

  it('descarta registros inválidos dentro de dados[]', () => {
    const result = apiResponseSchema.safeParse({
      ok: true, total: 2,
      dados: [
        { data: '2026-01-12', sala: '603 Sala', turma: 'APB.OPL.015', mes: 'Janeiro' },
        { data: 'INVALID',    sala: '',          turma: '',              mes: ''        },
      ],
      turnoMap: {},
    });
    // Schema deve descartar o registro inválido silenciosamente
    expect(result.success).toBe(true);
  });
});
