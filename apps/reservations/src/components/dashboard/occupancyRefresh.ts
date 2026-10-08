import type { OccupancyChangedPayload } from '../../services/socketClient';

// Debounce de fim de rajada pro sinal `occupancy.changed`: um lote de
// reservas (ex.: createRange) dispara vários eventos seguidos, e cada um
// recarregaria availability + nomes + stats. Aqui uma rajada vira UMA
// rodada, e eventos de outra data (não exibida) são ignorados.
export const OCCUPANCY_REFRESH_DELAY_MS = 300;

export interface OccupancyRefresher {
  handle: (payload: OccupancyChangedPayload) => void;
  cancel: () => void;
}

export function createOccupancyRefresher(
  getDisplayedDate: () => string,
  run: () => void,
  delayMs: number = OCCUPANCY_REFRESH_DELAY_MS,
): OccupancyRefresher {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    handle: payload => {
      if (payload.date !== getDisplayedDate()) return;
      cancel();
      timer = setTimeout(() => {
        timer = null;
        run();
      }, delayMs);
    },
    cancel,
  };
}
