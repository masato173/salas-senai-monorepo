// Tipos centrais do domínio — espelho do que o Apps Script retorna

export type Turno = 'M' | 'V' | 'N';

export type TurnoFiltro = Turno | 'TODOS';

export interface Registro {
  data: string;     // ISO: '2026-01-12'
  sala: string;
  turma: string;
  mes: string;
}

export interface TurnoMap {
  [turma: string]: Turno;
}

export interface ApiResponse {
  ok: boolean;
  total: number;
  dados: Registro[];
  turnoMap: TurnoMap;
}

export interface AppState {
  all:         Registro[];
  filtered:    Registro[];
  turnoMap:    TurnoMap;
  filtroTurno: TurnoFiltro;
  page:        number;
  refreshLock: boolean;
}
