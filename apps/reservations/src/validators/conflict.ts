import type { TimeSlot, SlotValidationResult } from '../types';

// ─────────────────────────────────────────────────────────────
// Fórmula canônica de sobreposição — nunca muda
// newStart < existingEnd && newEnd > existingStart
// Adjacentes NÃO conflitam: 09:30 não é < 09:30
// ─────────────────────────────────────────────────────────────
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function hasConflict(a: TimeSlot, b: TimeSlot): boolean {
  const aStart = toMinutes(a.start);
  const aEnd   = toMinutes(a.end);
  const bStart = toMinutes(b.start);
  const bEnd   = toMinutes(b.end);
  return aStart < bEnd && aEnd > bStart;
}

// ─────────────────────────────────────────────────────────────
// Regex: HH:MM onde HH 00–23, MM 00–59
// ─────────────────────────────────────────────────────────────
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Valida horário livre digitado pelo professor.
 *
 * Regras:
 *  - Formato HH:MM válido
 *  - end > start
 *  - Duração mínima: 30 minutos
 *  - Duração máxima: 4 horas (240 minutos)
 *  - Data futura e válida
 */
export function validateTimeInput(input: {
  start: string;
  end:   string;
  date:  string;
}): SlotValidationResult {
  // 1. Formato HH:MM
  if (!TIME_RE.test(input.start) || !TIME_RE.test(input.end)) {
    return { ok: false, error: 'Formato inválido. Use HH:MM (ex: 08:00).' };
  }

  // 2. Data
  if (!isValidDate(input.date)) {
    return { ok: false, error: 'Data inválida. Use o formato YYYY-MM-DD.' };
  }

  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(input.date + 'T00:00:00');
  if (selected < today) {
    return { ok: false, error: 'Não é possível reservar para uma data no passado.' };
  }

  // 3. end > start
  const startMin = toMinutes(input.start);
  const endMin   = toMinutes(input.end);
  const duration = endMin - startMin;

  if (duration <= 0) {
    return { ok: false, error: 'O horário de fim deve ser após o horário de início.' };
  }

  // 4. Duração mínima 30 min
  if (duration < 30) {
    return { ok: false, error: 'Duração mínima de 30 minutos.' };
  }

  // 5. Duração máxima 4 horas
  if (duration > 240) {
    return { ok: false, error: 'Duração máxima de 4 horas.' };
  }

  return { ok: true };
}

/**
 * Valida formato YYYY-MM-DD e se é data real.
 */
export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date + 'T00:00:00');
  return !isNaN(d.getTime()) && d.toISOString().startsWith(date);
}
