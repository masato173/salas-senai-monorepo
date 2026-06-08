import type { Turno, TurnoMap } from '../../../contracts/src/types';

/**
 * RegistroDTO — representação normalizada de um registro de sala.
 *
 * Contém os campos raw (vindos do Apps Script) mais campos
 * computados pelo mapper que o frontend usa diretamente.
 * Garante que nenhuma lógica de apresentação fique espalhada.
 */
export interface RegistroDTO {
  // ── Raw (Apps Script) ─────────────────────
  data:     string;      // ISO: '2026-01-12'
  sala:     string;
  turma:    string;
  mes:      string;

  // ── Computado pelo mapper ─────────────────
  turno:    Turno | null; // null = turma não mapeada no turnoMap
  isLab:    boolean;       // true se sala contém 'lab' (case-insensitive)
  dateLabel: string;       // '12/01/2026' — formato pt-BR
  dayLabel:  string;       // 'Seg', 'Ter'... — dia da semana abreviado
  turmaEsc:  string;       // turma com HTML escapado (XSS-safe)
  salaEsc:   string;       // sala com HTML escapado (XSS-safe)
}

export interface NormalizedPayload {
  registros: RegistroDTO[];
  turnoMap:  TurnoMap;
  total:     number;
}
