import type { RegistroLegado, Turno } from '../../types';

// Sprint A3.2 — função pura que espelha applyFilters() do dashboard legado.
// Substring case-insensitive na turma; match exato em data/sala/mês;
// turno usa o campo JÁ derivado (fetchSchedule enriquece via resolveTurno).
// Sort final: data → sala (cronológico + alfabético).

export type TurnoFiltro = 'TODOS' | Turno;

export interface ScheduleFilterState {
  turma: string; // busca substring case-insensitive ('' = ignora)
  data: string; // YYYY-MM-DD, match exato ('' = ignora)
  sala: string; // match exato ('' = ignora)
  mes: string; // match exato ('' = ignora)
  turno: TurnoFiltro; // 'TODOS' = ignora
}

export function applyScheduleFilters(
  registros: RegistroLegado[],
  filtros: ScheduleFilterState,
): RegistroLegado[] {
  const turmaUpper = filtros.turma.trim().toUpperCase();
  return registros
    .filter(r => {
      if (turmaUpper && !r.turma.toUpperCase().includes(turmaUpper)) return false;
      if (filtros.data && r.data !== filtros.data) return false;
      if (filtros.sala && r.sala !== filtros.sala) return false;
      if (filtros.mes && r.mes !== filtros.mes) return false;
      // turno: usa r.turno JÁ derivado (fetchSchedule enriquece via resolveTurno).
      // Legado fazia getTurno(r.turma) na hora; aqui o campo já vem pronto.
      if (filtros.turno !== 'TODOS' && r.turno !== filtros.turno) return false;
      return true;
    })
    .sort((a, b) => a.data.localeCompare(b.data) || a.sala.localeCompare(b.sala));
}
