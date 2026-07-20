import { describe, it, expect } from 'vitest';
import type { RegistroLegado } from '../../types';
import type { CreatedReservationRow } from '../apiTypes';
import { toMinutes, overlaps, buildRoomAvailability } from '../availability';

// Sprint Disponibilidade — testes puros do S2 (services/availability.ts).
// Sem mock, sem fetch, sem React. Vitest puro.

// ── Factories ────────────────────────────────────────────────
// Helpers pra construir mocks com apenas o que o teste precisa mudar.

function makeRegistro(overrides: Partial<RegistroLegado> = {}): RegistroLegado {
  return {
    data: '2026-06-15',
    sala: '603 Sala',
    turma: 'APB.OPL.015',
    mes: 'Junho',
    turno: 'M',
    inicio: null,
    fim: null,
    ...overrides,
  };
}

function makeReserva(overrides: Partial<CreatedReservationRow> = {}): CreatedReservationRow {
  return {
    id: 'res-001',
    sala: '603 Sala',
    data: '2026-06-15',
    inicio: '09:00',
    fim: '10:00',
    professor: 'Prof. Teste',
    turma: 'APB.ADM.001',
    observacao: '',
    status: 'ACTIVE',
    createdBy: 'teste@senai.edu',
    createdAt: '2026-06-15T08:00:00.000Z',
    updatedAt: '2026-06-15T08:00:00.000Z',
    ...overrides,
  };
}

const SALAS = ['603 Sala', '607 Sala', '610 Lab. Inf.'] as const;
const DATA = '2026-06-15';
const OUTRA_DATA = '2026-06-20';

// ── toMinutes ────────────────────────────────────────────────
describe('toMinutes()', () => {
  it('converte 07:30 → 450', () => expect(toMinutes('07:30')).toBe(450));
  it('converte 00:00 → 0', () => expect(toMinutes('00:00')).toBe(0));
  it('converte 23:59 → 1439', () => expect(toMinutes('23:59')).toBe(1439));
  it('converte 12:00 → 720', () => expect(toMinutes('12:00')).toBe(720));
  it('converte 13:00 → 780', () => expect(toMinutes('13:00')).toBe(780));
});

// ── overlaps ─────────────────────────────────────────────────
describe('overlaps()', () => {
  // casos de overlap
  it('detecta overlap parcial (a começa antes, termina dentro de b)', () => {
    expect(overlaps({ inicio: '07:00', fim: '09:00' }, { inicio: '08:00', fim: '10:00' })).toBe(
      true,
    );
  });
  it('detecta overlap parcial (a começa dentro, termina depois de b)', () => {
    expect(overlaps({ inicio: '09:00', fim: '11:00' }, { inicio: '08:00', fim: '10:00' })).toBe(
      true,
    );
  });
  it('detecta containment (a contém b inteiro)', () => {
    expect(overlaps({ inicio: '07:00', fim: '12:00' }, { inicio: '08:00', fim: '10:00' })).toBe(
      true,
    );
  });
  it('detecta containment (b contém a inteiro)', () => {
    expect(overlaps({ inicio: '08:00', fim: '10:00' }, { inicio: '07:00', fim: '12:00' })).toBe(
      true,
    );
  });
  it('detecta overlap exato (mesmos horários)', () => {
    expect(overlaps({ inicio: '08:00', fim: '10:00' }, { inicio: '08:00', fim: '10:00' })).toBe(
      true,
    );
  });

  // casos sem overlap
  it('NÃO conflita quando a termina antes de b começar', () => {
    expect(overlaps({ inicio: '07:00', fim: '08:00' }, { inicio: '09:00', fim: '10:00' })).toBe(
      false,
    );
  });
  it('NÃO conflita quando b termina antes de a começar', () => {
    expect(overlaps({ inicio: '11:00', fim: '12:00' }, { inicio: '08:00', fim: '10:00' })).toBe(
      false,
    );
  });
  it('bordas iguais (fim1 === inicio2) NÃO conflitam — tangência', () => {
    expect(overlaps({ inicio: '07:30', fim: '12:00' }, { inicio: '12:00', fim: '17:30' })).toBe(
      false,
    );
  });
  it('bordas iguais (fim2 === inicio1) NÃO conflitam — tangência', () => {
    expect(overlaps({ inicio: '13:00', fim: '17:30' }, { inicio: '07:30', fim: '13:00' })).toBe(
      false,
    );
  });
});

// ── buildRoomAvailability ─────────────────────────────────────
describe('buildRoomAvailability()', () => {
  // ── estrutura do resultado ───────────────────────────────
  it('retorna uma entrada por sala (mesmo sem eventos)', () => {
    const result = buildRoomAvailability([], [], DATA, SALAS);
    expect(result.salas).toHaveLength(SALAS.length);
    expect(result.salas.map(s => s.sala)).toEqual([...SALAS]);
  });

  it('todas as salas ficam "livre" quando não há eventos', () => {
    const result = buildRoomAvailability([], [], DATA, SALAS);
    result.salas.forEach(s => {
      expect(s.status).toBe('livre');
      expect(s.eventos).toHaveLength(0);
    });
  });

  it('geradoEm é uma string ISO válida', () => {
    const result = buildRoomAvailability([], [], DATA, SALAS);
    expect(() => new Date(result.geradoEm)).not.toThrow();
    expect(new Date(result.geradoEm).toISOString()).toBe(result.geradoEm);
  });

  it('data consultada é preservada no resultado', () => {
    const result = buildRoomAvailability([], [], DATA, SALAS);
    expect(result.data).toBe(DATA);
  });

  it('turno ausente no resultado quando não passado (spread condicional)', () => {
    const result = buildRoomAvailability([], [], DATA, SALAS);
    expect(result.turno).toBeUndefined();
  });

  it('turno presente no resultado quando passado', () => {
    const result = buildRoomAvailability([], [], DATA, SALAS, 'M');
    expect(result.turno).toBe('M');
  });

  // ── status por tipo de evento ────────────────────────────
  it('sala com aula → status "aula"', () => {
    const result = buildRoomAvailability(
      [makeRegistro({ sala: '603 Sala', turno: 'M' })],
      [],
      DATA,
      SALAS,
    );
    const sala = result.salas.find(s => s.sala === '603 Sala')!;
    expect(sala.status).toBe('aula');
    expect(sala.eventos).toHaveLength(1);
    expect(sala.eventos[0].tipo).toBe('aula');
    expect(sala.eventos[0].inicio).toBe('07:30'); // M → horário fixo
    expect(sala.eventos[0].fim).toBe('12:00');
  });

  it('sala com reserva ACTIVE → status "reserva"', () => {
    const result = buildRoomAvailability([], [makeReserva({ sala: '603 Sala' })], DATA, SALAS);
    const sala = result.salas.find(s => s.sala === '603 Sala')!;
    expect(sala.status).toBe('reserva');
    expect(sala.eventos[0].tipo).toBe('reserva');
    expect(sala.eventos[0].inicio).toBe('09:00');
    expect(sala.eventos[0].fim).toBe('10:00');
  });

  it('sala com aula + reserva → status "conflito"', () => {
    const result = buildRoomAvailability(
      [makeRegistro({ sala: '603 Sala', turno: 'M' })],
      [makeReserva({ sala: '603 Sala' })],
      DATA,
      SALAS,
    );
    const sala = result.salas.find(s => s.sala === '603 Sala')!;
    expect(sala.status).toBe('conflito');
    expect(sala.eventos).toHaveLength(2);
  });

  // ── filtragem de CANCELLED ────────────────────────────────
  it('reserva CANCELLED é excluída — sala fica "livre"', () => {
    const result = buildRoomAvailability(
      [],
      [makeReserva({ sala: '603 Sala', status: 'CANCELLED' })],
      DATA,
      SALAS,
    );
    const sala = result.salas.find(s => s.sala === '603 Sala')!;
    expect(sala.status).toBe('livre');
    expect(sala.eventos).toHaveLength(0);
  });

  // ── aula com turno=null ───────────────────────────────────
  it('aula com turno=null → bloqueia 00:00-23:59 (conservador)', () => {
    const result = buildRoomAvailability(
      [makeRegistro({ sala: '603 Sala', turno: null })],
      [],
      DATA,
      SALAS,
    );
    const sala = result.salas.find(s => s.sala === '603 Sala')!;
    expect(sala.status).toBe('aula');
    expect(sala.eventos[0].inicio).toBe('00:00');
    expect(sala.eventos[0].fim).toBe('23:59');
    expect(sala.eventos[0].turno).toBeNull(); // preserva null pra debug
  });

  // ── filtragem por data ────────────────────────────────────
  it('eventos de outra data são ignorados', () => {
    const result = buildRoomAvailability(
      [makeRegistro({ sala: '603 Sala', data: OUTRA_DATA })],
      [makeReserva({ sala: '603 Sala', data: OUTRA_DATA })],
      DATA,
      SALAS,
    );
    const sala = result.salas.find(s => s.sala === '603 Sala')!;
    expect(sala.status).toBe('livre');
  });

  // ── filtro de turno ───────────────────────────────────────
  it('filtro turno=M: aula M aparece, aula V não aparece', () => {
    const result = buildRoomAvailability(
      [
        makeRegistro({ sala: '603 Sala', turno: 'M' }),
        makeRegistro({ sala: '607 Sala', turno: 'V' }),
      ],
      [],
      DATA,
      SALAS,
      'M',
    );
    const sala603 = result.salas.find(s => s.sala === '603 Sala')!;
    const sala607 = result.salas.find(s => s.sala === '607 Sala')!;
    expect(sala603.status).toBe('aula'); // M → aparece
    expect(sala607.status).toBe('livre'); // V → filtrada
  });

  it('filtro turno=M: reserva 09:00-10:00 aparece (dentro de 07:30-12:00)', () => {
    const result = buildRoomAvailability(
      [],
      [makeReserva({ sala: '603 Sala', inicio: '09:00', fim: '10:00' })],
      DATA,
      SALAS,
      'M',
    );
    const sala = result.salas.find(s => s.sala === '603 Sala')!;
    expect(sala.status).toBe('reserva');
  });

  it('filtro turno=V: reserva 09:00-10:00 NÃO aparece (fora de 13:00-17:30)', () => {
    const result = buildRoomAvailability(
      [],
      [makeReserva({ sala: '603 Sala', inicio: '09:00', fim: '10:00' })],
      DATA,
      SALAS,
      'V',
    );
    const sala = result.salas.find(s => s.sala === '603 Sala')!;
    expect(sala.status).toBe('livre');
  });

  it('filtro turno=M: reserva 11:00-14:00 aparece (overlaps M=07:30-12:00)', () => {
    const result = buildRoomAvailability(
      [],
      [makeReserva({ sala: '603 Sala', inicio: '11:00', fim: '14:00' })],
      DATA,
      SALAS,
      'M',
    );
    const sala = result.salas.find(s => s.sala === '603 Sala')!;
    expect(sala.status).toBe('reserva'); // overlaps parcial com M
  });

  // ── isolamento entre salas ────────────────────────────────
  it('aula em 603 não afeta status de 607', () => {
    const result = buildRoomAvailability(
      [makeRegistro({ sala: '603 Sala', turno: 'M' })],
      [],
      DATA,
      SALAS,
    );
    const sala607 = result.salas.find(s => s.sala === '607 Sala')!;
    expect(sala607.status).toBe('livre');
    expect(sala607.eventos).toHaveLength(0);
  });
});
