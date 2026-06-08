import { describe, it, expect } from 'vitest';
import { toRegistroDTO, toRegistroListDTO, toNormalizedPayload } from '../registroMapper';

// ── TDD RED: mappers não existem ainda ──────────────────────

const VALID_RAW = {
  data: '2026-01-12', sala: '603 Sala',
  turma: 'APB.OPL.015', mes: 'Janeiro',
};
const TURNO_MAP = {
  'APB.OPL.015': 'V' as const,
  'APB.ADM.148': 'M' as const,
  'APB.OPL.123': 'N' as const,
};

describe('toRegistroDTO()', () => {
  it('mapeia campos corretamente', () => {
    const dto = toRegistroDTO(VALID_RAW, TURNO_MAP);
    expect(dto.data).toBe('2026-01-12');
    expect(dto.sala).toBe('603 Sala');
    expect(dto.turma).toBe('APB.OPL.015');
    expect(dto.mes).toBe('Janeiro');
  });

  it('resolve turno do mapa', () => {
    const dto = toRegistroDTO(VALID_RAW, TURNO_MAP);
    expect(dto.turno).toBe('V');
  });

  it('turno null para turma desconhecida', () => {
    const dto = toRegistroDTO(
      { ...VALID_RAW, turma: 'SESI-FRANKLIN' },
      TURNO_MAP,
    );
    expect(dto.turno).toBeNull();
  });

  it('resolve turno de célula com barra', () => {
    const dto = toRegistroDTO(
      { ...VALID_RAW, turma: 'APB.OPL.123/OPL.124' },
      TURNO_MAP,
    );
    expect(dto.turno).toBe('N');
  });

  it('isLab correto para sala com "lab" no nome', () => {
    const lab  = toRegistroDTO({ ...VALID_RAW, sala: '610 Lab. Inf.' }, TURNO_MAP);
    const sala = toRegistroDTO({ ...VALID_RAW, sala: '603 Sala' },      TURNO_MAP);
    expect(lab.isLab).toBe(true);
    expect(sala.isLab).toBe(false);
  });

  it('dateLabel formata data pt-BR corretamente', () => {
    const dto = toRegistroDTO(VALID_RAW, TURNO_MAP);
    // 2026-01-12 = segunda-feira
    expect(dto.dateLabel).toMatch(/12\/01\/2026/);
    expect(dto.dayLabel).toBe('Seg');
  });

  it('escapa HTML em turma (XSS)', () => {
    const xss = toRegistroDTO(
      { ...VALID_RAW, turma: '<script>alert(1)</script>' },
      TURNO_MAP,
    );
    expect(xss.turmaEsc).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(xss.turmaEsc).not.toContain('<script>');
  });

  it('escapa HTML em sala (XSS)', () => {
    const xss = toRegistroDTO(
      { ...VALID_RAW, sala: '<b>hack</b>' },
      TURNO_MAP,
    );
    expect(xss.salaEsc).toBe('&lt;b&gt;hack&lt;/b&gt;');
  });
});

describe('toRegistroListDTO()', () => {
  it('mapeia lista e ordena por data e sala', () => {
    const list = [
      { data: '2026-01-14', sala: '605 Sala', turma: 'APB.ADM.148', mes: 'Janeiro' },
      { data: '2026-01-12', sala: '603 Sala', turma: 'APB.OPL.015', mes: 'Janeiro' },
      { data: '2026-01-12', sala: '604 Sala', turma: 'APB.HML.003', mes: 'Janeiro' },
    ];
    const result = toRegistroListDTO(list, TURNO_MAP);
    expect(result[0].data).toBe('2026-01-12');
    expect(result[0].sala).toBe('603 Sala');
    expect(result[1].sala).toBe('604 Sala');
    expect(result[2].data).toBe('2026-01-14');
  });

  it('descarta registros inválidos silenciosamente', () => {
    const list = [
      VALID_RAW,
      { data: '', sala: '', turma: '', mes: '' }, // inválido
    ];
    const result = toRegistroListDTO(list, TURNO_MAP);
    expect(result).toHaveLength(1);
  });

  it('retorna lista vazia para input vazio', () => {
    expect(toRegistroListDTO([], TURNO_MAP)).toEqual([]);
  });
});

describe('toNormalizedPayload()', () => {
  it('normaliza payload completo', () => {
    const raw = {
      ok: true, total: 1,
      dados: [VALID_RAW],
      turnoMap: TURNO_MAP,
    };
    const result = toNormalizedPayload(raw);
    expect(result.registros).toHaveLength(1);
    expect(result.turnoMap).toEqual(TURNO_MAP);
    expect(result.total).toBe(1);
  });

  it('payload sem turnoMap → turnoMap vazio', () => {
    const raw = { ok: true, total: 0, dados: [] };
    const result = toNormalizedPayload(raw);
    expect(result.turnoMap).toEqual({});
  });

  it('payload inválido lança AppError', () => {
    expect(() => toNormalizedPayload(null)).toThrow();
    expect(() => toNormalizedPayload(undefined)).toThrow();
    expect(() => toNormalizedPayload('string')).toThrow();
  });
});
