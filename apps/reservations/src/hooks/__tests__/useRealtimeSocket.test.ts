import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupRealtimeSubscription } from '../useRealtimeSocket';
import type { ReservationEvent, ReservationEventPayload } from '../useRealtimeSocket';

// vi.hoisted garante que as variaveis existam quando vi.mock e hoisted para o topo
const { mockUnsubscribe, mockSubscribe } = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockSubscribe = vi.fn<any, any>(() => mockUnsubscribe);
  return { mockUnsubscribe, mockSubscribe };
});

vi.mock('../../services/socketClient', () => ({
  subscribeToReservationEvents: mockSubscribe,
  getSocket: vi.fn(),
  disconnectSocket: vi.fn(),
}));

const MOCK_PAYLOAD: ReservationEventPayload = {
  id: 'res-1',
  roomId: 'room-1',
  userId: 'user-1',
  date: '2026-07-13',
  inicio: '07:30',
  fim: '12:00',
  status: 'PENDING',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('setupRealtimeSubscription()', () => {
  it('chama subscribeToReservationEvents com callback', () => {
    const onEvent = vi.fn();
    setupRealtimeSubscription(onEvent);
    expect(mockSubscribe).toHaveBeenCalledWith(onEvent);
  });

  it('retorna a funcao unsubscribe do socketClient', () => {
    const onEvent = vi.fn();
    const cleanup = setupRealtimeSubscription(onEvent);
    expect(cleanup).toBe(mockUnsubscribe);
  });

  it('callback recebe event e payload corretamente', () => {
    const onEvent = vi.fn();
    let capturedCb: ((event: ReservationEvent, payload: ReservationEventPayload) => void) | null =
      null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSubscribe.mockImplementation((cb: any) => {
      capturedCb = cb as (event: ReservationEvent, payload: ReservationEventPayload) => void;
      return mockUnsubscribe;
    });
    setupRealtimeSubscription(onEvent);
    if (capturedCb !== null) {
      (capturedCb as (event: ReservationEvent, payload: ReservationEventPayload) => void)(
        'reservation.created',
        MOCK_PAYLOAD,
      );
    }
    expect(onEvent).toHaveBeenCalledWith('reservation.created', MOCK_PAYLOAD);
  });

  it('unsubscribe limpa o listener quando chamado', () => {
    const onEvent = vi.fn();
    const cleanup = setupRealtimeSubscription(onEvent);
    cleanup();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
