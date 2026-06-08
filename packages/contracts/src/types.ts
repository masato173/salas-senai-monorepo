/**
 * Contrato de tipos compartilhados entre todos os pacotes.
 * Fonte de verdade para o domínio — nunca redefinir em outro pacote.
 */

export type Turno = 'M' | 'V' | 'N';

export type TurnoFiltro = Turno | 'TODOS';

export const TURNOS_VALIDOS = ['M', 'V', 'N'] as const;

export const TURNO_LABEL: Record<Turno, string> = {
  M: 'Matutino',
  V: 'Vespertino',
  N: 'Noturno',
} as const;

export const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

export type Day = (typeof DAYS)[number];

/** Registro raw vindo do Apps Script — sem processamento */
export interface RegistroRaw {
  data:  string;
  sala:  string;
  turma: string;
  mes:   string;
}

/** Mapa turma→turno vindo do Apps Script */
export interface TurnoMap {
  [turma: string]: Turno;
}

/** Payload completo retornado pelo Apps Script */
export interface AppsScriptPayload {
  ok:       boolean;
  total:    number;
  dados:    RegistroRaw[];
  turnoMap: TurnoMap;
}

/** Filtros que o usuário pode aplicar */
export interface FilterInput {
  turma?:  string;
  data?:   string;
  sala?:   string;
  mes?:    string;
  turno?:  TurnoFiltro;
}

/** Parâmetros de paginação */
export interface PaginationInput {
  page:    number;
  perPage: number;
}
