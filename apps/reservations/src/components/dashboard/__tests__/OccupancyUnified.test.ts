import { describe, it, expect } from 'vitest';
import { sortSalas, getViewState, STATUS_STYLE, TIPO_LABEL } from '../OccupancyUnified';
import type { DisponibilidadeSala, RoomStatus, SalaEvento } from '../../../types';

// Nota: o projeto não usa @testing-library/react (nenhum teste no repo
// renderiza JSX — todos testam funções puras/hooks em isolamento, ex.
// applyScheduleFilters.ts). Estes testes seguem o mesmo padrão: cobrem a
// lógica pura extraída de OccupancyUnified.tsx (sortSalas, getViewState),
// não o output visual do componente.

function sala(nome: string, status: RoomStatus, eventos: SalaEvento[] = []): DisponibilidadeSala {
  return { sala: nome, status, eventos };
}

function aula(inicio: string, fim: string, turma = 'APB.ADM.148'): SalaEvento {
  return { tipo: 'aula', sala: '', data: '2026-07-22', inicio, fim, turma, turno: 'M' };
}

function reserva(inicio: string, fim: string, professor = 'Prof. Silva'): SalaEvento {
  return { tipo: 'reserva', sala: '', data: '2026-07-22', inicio, fim, professor };
}

describe('sortSalas', () => {
  it('ordena conflito > aula > reserva > livre', () => {
    const salas = [
      sala('608 Sala', 'livre'),
      sala('603 Sala', 'aula', [aula('07:30', '09:30')]),
      sala('610 Lab. Inf.', 'conflito', [aula('08:00', '10:00'), reserva('09:00', '11:00')]),
      sala('614 Lab. Elét.', 'reserva', [reserva('15:45', '17:45')]),
    ];

    const result = sortSalas(salas).map(s => s.sala);

    expect(result).toEqual(['610 Lab. Inf.', '603 Sala', '614 Lab. Elét.', '608 Sala']);
  });

  it('desempata por nome de sala (localeCompare) dentro do mesmo status', () => {
    const salas = [
      sala('B Sala', 'aula', [aula('07:30', '09:30')]),
      sala('A Sala', 'aula', [aula('10:00', '12:00')]),
    ];

    expect(sortSalas(salas).map(s => s.sala)).toEqual(['A Sala', 'B Sala']);
  });

  it('não muta o array original', () => {
    const salas = [sala('B Sala', 'livre'), sala('A Sala', 'conflito', [aula('07:00', '08:00')])];
    const original = [...salas];

    sortSalas(salas);

    expect(salas).toEqual(original);
  });

  it('sala em conflito real (aula + reserva sobrepostas) fica em primeiro', () => {
    const conflito = sala('612 Lab. CLP', 'conflito', [
      aula('08:00', '10:00'),
      reserva('09:00', '11:00'),
    ]);
    const salas = [sala('001 Sala', 'aula', [aula('07:00', '08:00')]), conflito];

    expect(sortSalas(salas)[0]).toBe(conflito);
    expect(sortSalas(salas)[0]?.eventos).toHaveLength(2);
  });

  it('array vazio retorna array vazio', () => {
    expect(sortSalas([])).toEqual([]);
  });
});

describe('getViewState', () => {
  it('retorna "loading" quando isLoading=true, independente de salas', () => {
    expect(getViewState([], true)).toBe('loading');
    expect(getViewState([sala('X', 'livre')], true)).toBe('loading');
  });

  it('retorna "empty" quando não está carregando e não há salas', () => {
    expect(getViewState([], false)).toBe('empty');
  });

  it('retorna "data" quando não está carregando e há ao menos 1 sala', () => {
    expect(getViewState([sala('X', 'livre')], false)).toBe('data');
  });
});

describe('STATUS_STYLE', () => {
  it('cobre os 4 RoomStatus com cor distinta cada', () => {
    const statuses: RoomStatus[] = ['livre', 'aula', 'reserva', 'conflito'];
    for (const s of statuses) {
      expect(STATUS_STYLE[s]).toBeDefined();
      expect(STATUS_STYLE[s].color).toMatch(/^var\(--color-/);
    }
    // 4 cores semânticas diferentes — nenhum status compartilha cor.
    const colors = new Set(statuses.map(s => STATUS_STYLE[s].color));
    expect(colors.size).toBe(4);
  });

  it('conflito é vermelho e livre é verde (âncoras do mapeamento pedido)', () => {
    expect(STATUS_STYLE.conflito.color).toBe('var(--color-red)');
    expect(STATUS_STYLE.livre.color).toBe('var(--color-green)');
  });
});

describe('TIPO_LABEL', () => {
  it('cobre os 2 tipos de evento (aula/reserva)', () => {
    expect(TIPO_LABEL.aula).toBe('Aula');
    expect(TIPO_LABEL.reserva).toBe('Reserva');
  });
});
