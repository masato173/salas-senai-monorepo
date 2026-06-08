/**
 * Escapa caracteres HTML especiais para prevenir XSS.
 *
 * DEVE ser chamada em TODO dado externo (planilha, API)
 * antes de inserir em innerHTML.
 *
 * Ordem de substituição importa: & deve ser primeiro,
 * senão "&lt;" vira "&amp;lt;" numa segunda passagem.
 */
export function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
