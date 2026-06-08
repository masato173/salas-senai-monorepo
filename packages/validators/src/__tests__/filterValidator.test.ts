import { describe, it, expect } from 'vitest';
import {
  filterInputSchema,
  validateFilterInput,
  paginationSchema,
  turnoFiltroSchema,
} from '../filterValidator';

// ── TDD RED: validators não existem ainda ───────────────────

describe('filterInputSchema', () => {
  it('aceita todos os filtros válidos', () => {
    const result = filterInputSchema.safeParse({
      turma: 'ADM', data: '2026-01-12',
      sala: '603 Sala', mes: 'Janeiro',
      turno: 'M',
    });
    expect(result.success).toBe(true);
  });

  it('aceita objeto vazio (nenhum filtro aplicado)', () => {
    expect(filterInputSchema.safeParse({}).success).toBe(true);
  });

  it('aceita filtro com só turma', () => {
    expect(filterInputSchema.safeParse({ turma: 'APB' }).success).toBe(true);
  });

  it('rejeita data em formato errado', () => {
    expect(filterInputSchema.safeParse({ data: '12/01/2026' }).success).toBe(false);
    expect(filterInputSchema.safeParse({ data: 'amanhã' }).success).toBe(false);
  });

  it('rejeita turno inválido', () => {
    expect(filterInputSchema.safeParse({ turno: 'X' }).success).toBe(false);
    expect(filterInputSchema.safeParse({ turno: 'm' }).success).toBe(false);
  });

  it('aceita turno TODOS', () => {
    expect(filterInputSchema.safeParse({ turno: 'TODOS' }).success).toBe(true);
  });

  it('trunca turma com mais de 50 chars (proteção DoS)', () => {
    const longa = 'A'.repeat(200);
    const result = filterInputSchema.safeParse({ turma: longa });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.turma?.length).toBeLessThanOrEqual(50);
  });

  it('faz trim em todos os strings', () => {
    const result = filterInputSchema.safeParse({ turma: '  ADM  ', mes: '  Janeiro  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.turma).toBe('ADM');
      expect(result.data.mes).toBe('Janeiro');
    }
  });
});

describe('turnoFiltroSchema', () => {
  it('aceita M, V, N, TODOS', () => {
    ['M', 'V', 'N', 'TODOS'].forEach(t => {
      expect(turnoFiltroSchema.safeParse(t).success).toBe(true);
    });
  });

  it('rejeita qualquer outro valor', () => {
    ['m', 'X', '', 'MANHA', null].forEach(t => {
      expect(turnoFiltroSchema.safeParse(t).success).toBe(false);
    });
  });
});

describe('paginationSchema', () => {
  it('aceita página e perPage válidos', () => {
    expect(paginationSchema.safeParse({ page: 1, perPage: 40 }).success).toBe(true);
  });

  it('page default é 1', () => {
    const r = paginationSchema.safeParse({ perPage: 40 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.page).toBe(1);
  });

  it('perPage default é 40', () => {
    const r = paginationSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.perPage).toBe(40);
  });

  it('rejeita page <= 0', () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(paginationSchema.safeParse({ page: -1 }).success).toBe(false);
  });

  it('limita perPage a no máximo 100 (proteção)', () => {
    const r = paginationSchema.safeParse({ perPage: 999 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.perPage).toBeLessThanOrEqual(100);
  });
});

describe('validateFilterInput()', () => {
  it('retorna dados validados para input válido', () => {
    const result = validateFilterInput({ turma: 'ADM', turno: 'M' });
    expect(result.turma).toBe('ADM');
    expect(result.turno).toBe('M');
  });

  it('lança AppError para input inválido', () => {
    expect(() => validateFilterInput({ data: 'não-é-data' })).toThrow();
  });
});
