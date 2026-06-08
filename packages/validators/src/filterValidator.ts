import { z } from 'zod';
import { AppError } from '../../shared/src/errors/AppError';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const turnoFiltroSchema = z.enum(['M', 'V', 'N', 'TODOS']);

/**
 * Schema de validação dos filtros.
 * Proteções aplicadas:
 * - turma: trim + max 50 chars (evita strings gigantes no indexOf)
 * - data: deve ser ISO se informada
 * - turno: apenas valores conhecidos
 */
export const filterInputSchema = z.object({
  turma: z
    .string()
    .trim()
    .max(50)
    .optional(),
  data: z
    .string()
    .trim()
    .regex(ISO_DATE, 'Data deve ser no formato YYYY-MM-DD')
    .optional()
    .or(z.literal('')),
  sala: z.string().trim().optional(),
  mes:  z.string().trim().optional(),
  turno: turnoFiltroSchema.optional(),
});

/**
 * Schema de paginação com defaults e limites seguros.
 * perPage máximo = 100 para evitar payload gigante.
 */
export const paginationSchema = z.object({
  page:    z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(40),
});

export type FilterInput      = z.infer<typeof filterInputSchema>;
export type PaginationInput  = z.infer<typeof paginationSchema>;

/**
 * Valida e retorna os filtros normalizados.
 * Lança AppError.validation se inválido.
 */
export function validateFilterInput(raw: unknown): FilterInput {
  const result = filterInputSchema.safeParse(raw);
  if (!result.success) {
    throw AppError.validation(
      'Filtro inválido: ' + result.error.issues.map(i => i.message).join(', '),
      result.error,
    );
  }
  return result.data;
}

export function validatePagination(raw: unknown): PaginationInput {
  const result = paginationSchema.safeParse(raw);
  if (!result.success) {
    throw AppError.validation('Paginação inválida.', result.error);
  }
  return result.data;
}
