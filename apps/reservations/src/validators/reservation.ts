import type { CreateReservationInput, ValidationResult } from '../types';

const TURNOS_VALIDOS = ['M', 'V', 'N'] as const;
// Regex que rejeita qualquer tag HTML ou caractere de controle
const SAFE_TEXT_RE = /^[^<>"'&{}[\]\\]+$/;

/**
 * Valida o DTO de criação de reserva.
 * Acumula TODOS os erros — não para no primeiro.
 *
 * Segurança: nunca confiar em dados do frontend.
 * Esta função deve ser espelhada no backend quando houver NestJS.
 */
export function validateReservation(input: Partial<CreateReservationInput>): ValidationResult {
  const errors: string[] = [];

  if (!input.roomId?.trim()) {
    errors.push('roomId é obrigatório');
  }

  if (!input.userId?.trim()) {
    errors.push('userId é obrigatório');
  }

  if (!input.turno || !(TURNOS_VALIDOS as readonly string[]).includes(input.turno)) {
    errors.push('turno deve ser M, V ou N');
  }

  if (input.reason !== undefined) {
    if (input.reason.length > 200) {
      errors.push('reason deve ter no máximo 200 caracteres');
    }
    if (input.reason.length > 0 && !SAFE_TEXT_RE.test(input.reason)) {
      errors.push('reason contém caracteres inválidos');
    }
  }

  return { ok: errors.length === 0, errors };
}
