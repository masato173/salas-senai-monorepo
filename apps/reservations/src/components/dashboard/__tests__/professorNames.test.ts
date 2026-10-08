import { describe, it, expect } from 'vitest';
import {
  buildProfessorNameMap,
  withProfessorNames,
  professorLabel,
  shouldFetchNames,
} from '../professorNames';
import type { DayReservationItem } from '../../../services/apiTypes';
import type { DisponibilidadeSala, SalaEvento } from '../../../types';

// Nomes fictícios — nunca dados reais de usuários.
function dayItem(id: string, professor?: string): DayReservationItem {
  return {
    id,
    sala: '01 Sala',
    inicio: '08:00',
    fim: '10:00',
    status: 'APPROVED',
    turma: null,
    ...(professor !== undefined ? { professor } : {}),
  };
}

function reserva(id: string): SalaEvento {
  return {
    tipo: 'reserva',
    sala: '01 Sala',
    data: '2026-07-22',
    inicio: '08:00',
    fim: '10:00',
    id,
  };
}

function aula(): SalaEvento {
  return {
    tipo: 'aula',
    sala: '01 Sala',
    data: '2026-07-22',
    inicio: '07:00',
    fim: '09:00',
    turma: 'T1',
  };
}

function sala(eventos: SalaEvento[]): DisponibilidadeSala {
  return { sala: '01 Sala', status: 'reserva', eventos };
}

describe('buildProfessorNameMap', () => {
  it('mapeia id da reserva → nome do professor', () => {
    const map = buildProfessorNameMap([
      dayItem('r1', 'Prof. Ana Ficticia'),
      dayItem('r2', 'Prof. Beto Ficticio'),
    ]);
    expect(map.get('r1')).toBe('Prof. Ana Ficticia');
    expect(map.get('r2')).toBe('Prof. Beto Ficticio');
  });

  it('ignora item sem professor', () => {
    expect(buildProfessorNameMap([dayItem('r1')]).size).toBe(0);
  });
});

describe('withProfessorNames', () => {
  it('reserva com correspondência por id recebe o nome', () => {
    const map = buildProfessorNameMap([dayItem('r1', 'Prof. Ana Ficticia')]);
    const [s] = withProfessorNames([sala([reserva('r1')])], map);
    expect(s.eventos[0].professor).toBe('Prof. Ana Ficticia');
  });

  it('reserva sem correspondência fica sem nome, sem erro', () => {
    const map = buildProfessorNameMap([dayItem('outra', 'Prof. Ana Ficticia')]);
    const [s] = withProfessorNames([sala([reserva('r1')])], map);
    expect(s.eventos[0]).not.toHaveProperty('professor');
  });

  it('aula nunca recebe nome', () => {
    const map = buildProfessorNameMap([dayItem('r1', 'Prof. Ana Ficticia')]);
    const [s] = withProfessorNames([sala([aula()])], map);
    expect(s.eventos[0]).not.toHaveProperty('professor');
  });

  it('mapa vazio (visitante anônimo) → nenhum nome em lugar nenhum', () => {
    const result = withProfessorNames([sala([reserva('r1'), aula()])], new Map());
    expect(JSON.stringify(result)).not.toContain('professor');
  });

  it('não muta as salas de entrada', () => {
    const entrada = [sala([reserva('r1')])];
    const copia = JSON.parse(JSON.stringify(entrada)) as DisponibilidadeSala[];
    withProfessorNames(entrada, buildProfessorNameMap([dayItem('r1', 'Prof. Ana Ficticia')]));
    expect(entrada).toEqual(copia);
  });
});

describe('professorLabel', () => {
  it('prefixa "Prof."', () => {
    expect(professorLabel('Ana Ficticia')).toBe('Prof. Ana Ficticia');
  });
});

describe('shouldFetchNames', () => {
  it('sem token (não logado) → não busca', () => {
    expect(shouldFetchNames(null)).toBe(false);
    expect(shouldFetchNames('')).toBe(false);
  });

  it('com token (logado) → busca', () => {
    expect(shouldFetchNames('token-ficticio')).toBe(true);
  });
});
