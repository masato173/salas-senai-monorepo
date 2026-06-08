/**
 * Escapa caracteres HTML para prevenir XSS.
 * Deve ser chamada em TODO dado externo antes de inserir em DOM.
 * A ordem importa: & deve ser primeiro.
 */
export function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Remove tags HTML completas de uma string.
 * Para casos onde queremos texto puro sem entidades.
 */
export function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}
