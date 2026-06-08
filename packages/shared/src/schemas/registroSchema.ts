import { z } from 'zod';
import { TURNOS_VALIDOS } from '../../../contracts/src/types';

// Regex ISO date: YYYY-MM-DD
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Schema de um registro individual.
 * Faz trim em todos os campos e valida formato ISO da data.
 */
export const registroSchema = z.object({
  data:  z.string().trim().regex(ISO_DATE, 'Data deve estar no formato YYYY-MM-DD'),
  sala:  z.string().trim().min(1, 'Sala não pode ser vazia'),
  turma: z.string().trim().min(1, 'Turma não pode ser vazia'),
  mes:   z.string().trim().min(1, 'Mês não pode ser vazio'),
});

/**
 * Schema do mapa turma→turno.
 * Só aceita M, V, N como valores — rejeita qualquer outro.
 */
export const turnoMapSchema = z.record(
  z.string(),
  z.enum(TURNOS_VALIDOS),
);

/**
 * Schema da resposta completa do Apps Script.
 *
 * Usa .catch() nos arrays para descartar registros inválidos
 * silenciosamente em vez de falhar todo o payload — o sistema
 * legado pode ter dados parcialmente corrompidos e deve continuar.
 */
export const apiResponseSchema = z.object({
  ok:       z.boolean().default(false),
  total:    z.number().int().nonnegative().default(0),
  dados:    z
    .array(
      z
        .unknown()
        .transform(item => registroSchema.safeParse(item))
        .transform(result => (result.success ? result.data : null))
    )
    .transform(items => items.filter((item): item is z.infer<typeof registroSchema> => item !== null))
    .default([]),
  turnoMap: turnoMapSchema.default({}),
});

export type RegistroRawValidated = z.infer<typeof registroSchema>;
export type ApiResponseValidated  = z.infer<typeof apiResponseSchema>;
