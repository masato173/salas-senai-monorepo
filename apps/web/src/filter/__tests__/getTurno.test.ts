import { describe, it, expect, beforeEach } from 'vitest';
import { createGetTurno } from '../getTurno';

// TDD: testes escritos ANTES da implementação

describe('getTurno()', () => {
  const turnoMap = {
    'APB.OPL.015':  'V',
    'APB.ADM.148':  'M',
    'APB.OPL.097':  'M',
    'APB.ADM.112':  'V',
  };
  const getTurno = createGetTurno(turnoMap);

  it('retorna o turno de uma turma conhecida', () => {
    expect(getTurno('APB.OPL.015')).toBe('V');
    expect(getTurno('APB.ADM.148')).toBe('M');
  });

  it('retorna null para turma desconhecida', () => {
    expect(getTurno('TURMA.INEXISTENTE')).toBeNull();
  });

  it('faz trim na chave antes de buscar', () => {
    expect(getTurno('  APB.OPL.015  ')).toBe('V');
  });

  it('suporta célula com barra "APB.OPL.123/OPL.124"', () => {
    const mapComBarra = { ...turnoMap, 'APB.OPL.123': 'N' };
    const fn = createGetTurno(mapComBarra);
    expect(fn('APB.OPL.123/OPL.124')).toBe('N');
  });

  it('retorna null se turnoMap estiver vazio', () => {
    const fn = createGetTurno({});
    expect(fn('APB.OPL.015')).toBeNull();
  });

  it('a primeira parte da barra prevalece se ambas tiverem turno', () => {
    const mapDual = { 'APB.OPL.123': 'N', 'OPL.124': 'M' };
    const fn = createGetTurno(mapDual);
    expect(fn('APB.OPL.123/OPL.124')).toBe('N');
  });
});
