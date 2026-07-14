import { useEffect, useRef } from 'react';
import { subscribeToReservationEvents } from '../services/socketClient';
import type { ReservationEvent, ReservationEventPayload } from '../services/socketClient';

// ─────────────────────────────────────────────────────────────
// useRealtimeSocket — F7.3
//
// Subscreve eventos de reserva via mini-emitter do socketClient.
// NÃO chama socket.on diretamente — usa subscribeToReservationEvents.
// NÃO gerencia conexão — responsabilidade do AppLayout.
//
// Padrão: callbackRef (igual ao serviceRef do projeto) evita
// re-subscribe quando o callback muda entre renders.
//
// Uso em páginas (F7.3b):
//   useRealtimeSocket({
//     onReservationEvent: (_event, _payload) => void refetch(),
//   });
// ─────────────────────────────────────────────────────────────

export type { ReservationEvent, ReservationEventPayload };

export interface UseRealtimeSocketOptions {
  onReservationEvent?: (event: ReservationEvent, payload: ReservationEventPayload) => void;
}

// Função pura testável — separa lógica de subscrição do hook React
export function setupRealtimeSubscription(
  onEvent: (event: ReservationEvent, payload: ReservationEventPayload) => void,
): () => void {
  return subscribeToReservationEvents(onEvent);
}

export function useRealtimeSocket(options: UseRealtimeSocketOptions = {}): void {
  const callbackRef = useRef(options.onReservationEvent);
  callbackRef.current = options.onReservationEvent; // sempre atualizado sem re-subscribe

  useEffect(() => {
    const unsubscribe = setupRealtimeSubscription((event, payload) => {
      callbackRef.current?.(event, payload);
    });
    return unsubscribe; // cleanup no unmount
    // Mount-only — callbackRef nunca causa re-subscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
