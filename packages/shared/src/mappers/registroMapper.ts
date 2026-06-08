import { AppError } from '../errors/AppError';
import { registroSchema, apiResponseSchema } from '../schemas/registroSchema';
import type { RegistroRawValidated } from '../schemas/registroSchema';
import type { RegistroDTO, NormalizedPayload } from '../dto/registroDTO';
import { DAYS, TURNO_LABEL, type Turno, type TurnoMap } from '../../../contracts/src/types';

// ── Helpers internos ─────────────────────────────────────────

/** Escapa HTML — mesma lógica do legado, agora tipada e testada */
function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Resolve turno de uma célula, suportando "APB.X/APB.Y".
 * Comportamento idêntico ao legado — garantido pelos testes.
 */
function resolveTurno(turma: string, turnoMap: TurnoMap): Turno | null {
  const chave = turma.trim();
  if (turnoMap[chave]) return turnoMap[chave];
  for (const parte of chave.split('/')) {
    const t = turnoMap[parte.trim()];
    if (t) return t;
  }
  return null;
}

/**
 * Formata data ISO 'YYYY-MM-DD' para 'DD/MM/YYYY'.
 * Usa T12:00:00 para evitar bug de fuso horário
 * (idêntico ao legado: new Date(r.data + 'T12:00:00')).
 */
function formatDate(isoDate: string): { dateLabel: string; dayLabel: string } {
  const d = new Date(isoDate + 'T12:00:00');
  if (isNaN(d.getTime())) {
    return { dateLabel: isoDate, dayLabel: '—' };
  }
  return {
    dateLabel: d.toLocaleDateString('pt-BR'),
    dayLabel:  DAYS[d.getDay()],
  };
}

// ── Exports públicos ─────────────────────────────────────────

/**
 * Converte um registro raw em RegistroDTO normalizado.
 * Inclui campos de apresentação pré-computados (turmaEsc, salaEsc, etc.)
 * para que o render não precise de nenhuma lógica extra.
 */
export function toRegistroDTO(
  raw:      RegistroRawValidated | Record<string, unknown>,
  turnoMap: TurnoMap,
): RegistroDTO {
  const validated = registroSchema.parse(raw);
  const { dateLabel, dayLabel } = formatDate(validated.data);

  return {
    data:      validated.data,
    sala:      validated.sala,
    turma:     validated.turma,
    mes:       validated.mes,
    turno:     resolveTurno(validated.turma, turnoMap),
    isLab:     validated.sala.toLowerCase().includes('lab'),
    dateLabel,
    dayLabel,
    turmaEsc:  esc(validated.turma),
    salaEsc:   esc(validated.sala),
  };
}

/**
 * Converte lista de raws em DTOs, descartando inválidos,
 * ordenados por data e sala (idêntico ao legado).
 */
export function toRegistroListDTO(
  raws:     unknown[],
  turnoMap: TurnoMap,
): RegistroDTO[] {
  return raws
    .map(raw => {
      const result = registroSchema.safeParse(raw);
      if (!result.success) return null;
      return toRegistroDTO(result.data, turnoMap);
    })
    .filter((dto): dto is RegistroDTO => dto !== null)
    .sort((a, b) => a.data.localeCompare(b.data) || a.sala.localeCompare(b.sala));
}

/**
 * Normaliza o payload bruto do Apps Script.
 * Ponto de entrada principal — lança AppError para payload inválido.
 */
export function toNormalizedPayload(raw: unknown): NormalizedPayload {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    throw AppError.parse('Payload inválido recebido do servidor.', raw);
  }

  const parsed = apiResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw AppError.parse('Estrutura do payload não reconhecida.', parsed.error);
  }

  const { dados, turnoMap, total } = parsed.data;
  const registros = toRegistroListDTO(dados, turnoMap);

  return { registros, turnoMap, total };
}

// Re-export para uso no adapter
export { esc, resolveTurno, TURNO_LABEL };
