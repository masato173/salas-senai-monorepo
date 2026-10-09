import type { BackendError } from '../../services/apiTypes';

// #22 — a edição em lote (grupo / selecionadas) virou tudo-ou-nada: conflito
// de horário devolve 409 com a mensagem em PT-BR já listando as datas.
// `details.conflicts` não é preenchido pelo nestjsApiService (toBackendError
// só copia code/message) — sem a lista, a UI mostrava "Conflito em 0
// data(s): ". Pura e exportada para teste (o projeto não usa
// @testing-library).
const MAX_DATES_SHOWN = 10;

export function batchConflictMessage(error: BackendError): string {
  const conflicts = error.details?.conflicts ?? [];
  if (conflicts.length === 0) {
    return error.message !== ''
      ? error.message
      : 'Conflito de horário. Nenhuma alteração foi salva.';
  }
  const shown = conflicts.slice(0, MAX_DATES_SHOWN).map(isoToDayMonth).join(', ');
  const more = conflicts.length - MAX_DATES_SHOWN;
  return `Conflito em ${conflicts.length} data(s): ${shown}${more > 0 ? ` (+${more} mais)` : ''}`;
}

function isoToDayMonth(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
