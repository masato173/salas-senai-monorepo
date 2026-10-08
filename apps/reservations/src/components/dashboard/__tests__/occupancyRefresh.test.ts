import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOccupancyRefresher, OCCUPANCY_REFRESH_DELAY_MS } from '../occupancyRefresh';

describe('createOccupancyRefresher (debounce + filtro de data)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rajada de N eventos da data exibida → 1 única rodada', () => {
    const run = vi.fn();
    const r = createOccupancyRefresher(() => '2026-07-22', run);

    for (let i = 0; i < 5; i++) r.handle({ roomId: `room-${i}`, date: '2026-07-22' });
    expect(run).not.toHaveBeenCalled();

    vi.advanceTimersByTime(OCCUPANCY_REFRESH_DELAY_MS);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('evento de outra data → nenhuma rodada', () => {
    const run = vi.fn();
    const r = createOccupancyRefresher(() => '2026-07-22', run);

    r.handle({ roomId: 'room-1', date: '2026-07-23' });
    vi.advanceTimersByTime(OCCUPANCY_REFRESH_DELAY_MS * 3);
    expect(run).not.toHaveBeenCalled();
  });

  it('usa a data exibida no momento do evento (troca de data)', () => {
    let exibida = '2026-07-22';
    const run = vi.fn();
    const r = createOccupancyRefresher(() => exibida, run);

    exibida = '2026-07-23';
    r.handle({ roomId: 'room-1', date: '2026-07-22' });
    vi.advanceTimersByTime(OCCUPANCY_REFRESH_DELAY_MS);
    expect(run).not.toHaveBeenCalled();
  });

  it('cancel() descarta a rodada pendente (unmount / troca de data)', () => {
    const run = vi.fn();
    const r = createOccupancyRefresher(() => '2026-07-22', run);

    r.handle({ roomId: 'room-1', date: '2026-07-22' });
    r.cancel();
    vi.advanceTimersByTime(OCCUPANCY_REFRESH_DELAY_MS * 3);
    expect(run).not.toHaveBeenCalled();
  });

  it('duas rajadas separadas → 2 rodadas', () => {
    const run = vi.fn();
    const r = createOccupancyRefresher(() => '2026-07-22', run);

    r.handle({ roomId: 'room-1', date: '2026-07-22' });
    vi.advanceTimersByTime(OCCUPANCY_REFRESH_DELAY_MS);
    r.handle({ roomId: 'room-2', date: '2026-07-22' });
    vi.advanceTimersByTime(OCCUPANCY_REFRESH_DELAY_MS);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
