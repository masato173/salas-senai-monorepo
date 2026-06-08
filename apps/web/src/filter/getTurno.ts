import type { TurnoMap, Turno } from '../types';

/**
 * Factory que retorna uma função de lookup turma→turno.
 *
 * Por que factory? Permite injetar o turnoMap nos testes
 * sem depender de estado global.
 *
 * Suporta células com barra: "APB.OPL.123/OPL.124"
 * A primeira parte que tiver match prevalece.
 */
export function createGetTurno(turnoMap: TurnoMap) {
  return function getTurno(turma: string): Turno | null {
    const chave = turma.trim();

    // Lookup direto (caso mais comum)
    if (turnoMap[chave]) return turnoMap[chave];

    // Célula com múltiplas turmas separadas por barra
    const partes = chave.split('/');
    for (const parte of partes) {
      const t = turnoMap[parte.trim()];
      if (t) return t;
    }

    return null;
  };
}
