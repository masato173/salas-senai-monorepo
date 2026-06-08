import { describe, it, expect } from 'vitest';
import { expandDateRange } from '../dateRange';

// ─────────────────────────────────────────────────────────────
// Paridade com expandDateRange do backend (codigo.gs).
// Convenção: 0=domingo .. 6=sábado.
// Construção em meio-dia UTC: getUTCDay() do meio-dia UTC bate com
// o dia da semana em Manaus (08:00 local do mesmo dia).
// Limite: > 60 (mesmo do backend — devolve até 61 como sinal de estouro).
// ─────────────────────────────────────────────────────────────

describe('expandDateRange()', () => {
  it('paridade backend — TESTE 1 (10/12/2026 a 15/12/2026, ter+qui) → [10/12 qui, 15/12 ter]', () => {
    const r = expandDateRange('2026-12-10', '2026-12-15', [2, 4]);
    expect(r).toEqual(['2026-12-10', '2026-12-15']);
  });

  it('paridade backend — TESTE 8 (período de 1 dia exato em 15/02/2027 segunda) → 1 reserva', () => {
    const r = expandDateRange('2027-02-15', '2027-02-15', [1]);
    expect(r).toEqual(['2027-02-15']);
  });

  it('mesmo dia início=fim mas dia da semana não bate → vazio', () => {
    // 2027-02-15 é segunda (1). Filtrando por terça (2) → nada.
    const r = expandDateRange('2027-02-15', '2027-02-15', [2]);
    expect(r).toEqual([]);
  });

  it('diasSemana vazio → vazio', () => {
    const r = expandDateRange('2026-12-10', '2026-12-31', []);
    expect(r).toEqual([]);
  });

  it('dataFim antes de dataInicio → vazio (loop não roda)', () => {
    const r = expandDateRange('2026-12-20', '2026-12-10', [1, 2, 3, 4, 5]);
    expect(r).toEqual([]);
  });

  it('convenção 0=domingo, 6=sábado (semana de 04/01/2026 a 10/01/2026)', () => {
    // 2026-01-04 dom (0), 05 seg (1), 06 ter (2), 07 qua (3), 08 qui (4), 09 sex (5), 10 sab (6)
    const todosOsDias = expandDateRange('2026-01-04', '2026-01-10', [0, 1, 2, 3, 4, 5, 6]);
    expect(todosOsDias).toEqual([
      '2026-01-04', // dom
      '2026-01-05', // seg
      '2026-01-06', // ter
      '2026-01-07', // qua
      '2026-01-08', // qui
      '2026-01-09', // sex
      '2026-01-10', // sab
    ]);

    // só domingos
    expect(expandDateRange('2026-01-04', '2026-01-10', [0])).toEqual(['2026-01-04']);
    // só sábados
    expect(expandDateRange('2026-01-04', '2026-01-10', [6])).toEqual(['2026-01-10']);
  });

  it('não escorrega de dia em borda de ano (31/12 → 01/01)', () => {
    // 2026-12-31 quinta (4), 2027-01-01 sexta (5)
    const r = expandDateRange('2026-12-31', '2027-01-01', [4, 5]);
    expect(r).toEqual(['2026-12-31', '2027-01-01']);
  });

  it('paridade backend — TESTE 7 (01/01/2027 a 30/06/2027, seg-sex) estoura → length 61 (sinal de limite)', () => {
    const r = expandDateRange('2027-01-01', '2027-06-30', [1, 2, 3, 4, 5]);
    // Backend: `if (datas.length > 60) break;` checa APÓS push → pode devolver 61
    expect(r.length).toBe(61);
  });

  it('não duplica datas mesmo se diasSemana tiver valores repetidos', () => {
    const r = expandDateRange('2026-12-10', '2026-12-15', [2, 2, 4, 4]);
    expect(r).toEqual(['2026-12-10', '2026-12-15']);
  });

  it('retorna strings no formato YYYY-MM-DD', () => {
    const r = expandDateRange('2026-12-10', '2026-12-31', [1, 3, 5]);
    expect(r.length).toBeGreaterThan(0);
    r.forEach(d => expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/));
  });
});
