import { describe, it, expect } from 'vitest';
import type { RegistroDTO, NormalizedPayload } from '../registroDTO';

// ── TDD RED: DTOs são tipos — só verifica forma em runtime ───

describe('RegistroDTO shape', () => {
  it('RegistroDTO tem todos os campos obrigatórios', () => {
    const dto: RegistroDTO = {
      // Campos do raw (vindos do Apps Script)
      data:     '2026-01-12',
      sala:     '603 Sala',
      turma:    'APB.OPL.015',
      mes:      'Janeiro',
      // Campos computados pelo mapper
      turno:    'V',
      isLab:    false,
      dateLabel:'12/01/2026',
      dayLabel: 'Seg',
      turmaEsc: 'APB.OPL.015',
      salaEsc:  '603 Sala',
    };
    // Se compilar, o tipo está correto
    expect(dto.turno).toBe('V');
    expect(dto.isLab).toBe(false);
    expect(dto.turmaEsc).toBe('APB.OPL.015');
  });

  it('RegistroDTO aceita turno null (turma não mapeada)', () => {
    const dto: RegistroDTO = {
      data: '2026-01-12', sala: '603 Sala',
      turma: 'SESI-FRANKLIN', mes: 'Janeiro',
      turno: null,
      isLab: false, dateLabel: '12/01/2026', dayLabel: 'Seg',
      turmaEsc: 'SESI-FRANKLIN', salaEsc: '603 Sala',
    };
    expect(dto.turno).toBeNull();
  });

  it('NormalizedPayload tem estrutura correta', () => {
    const payload: NormalizedPayload = {
      registros: [],
      turnoMap: { 'APB.OPL.015': 'V' },
      total: 0,
    };
    expect(payload.registros).toEqual([]);
    expect(payload.turnoMap['APB.OPL.015']).toBe('V');
  });
});
