import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { API_BASE } from '../config/api';

// ─────────────────────────────────────────────────────────────
// socketClient — F7.3
//
// Singleton com lazy init — sem conexão automática no import.
// Mini-emitter interno (Set<EventCallback>) resolve o problema
// de múltiplos listeners: socket.on é registrado 1× no getSocket;
// páginas subscrevem via subscribeToReservationEvents.
//
// Namespace: /rooms (confirmado no RealtimeGateway do backend)
// Auth: token JWT em handshake.auth.token (ADR F4.10b)
//
// Payload dos eventos (RealtimeService do backend):
//   { id, roomId, userId, date, inicio, fim, status }
// ─────────────────────────────────────────────────────────────

export type ReservationEvent =
  | 'reservation.created'
  | 'reservation.updated'
  | 'reservation.approved'
  | 'reservation.rejected'
  | 'reservation.cancelled';

export interface ReservationEventPayload {
  id: string;
  roomId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  inicio: string;
  fim: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
}

type EventCallback = (event: ReservationEvent, payload: ReservationEventPayload) => void;

const EVENTS: ReservationEvent[] = [
  'reservation.created',
  'reservation.updated',
  'reservation.approved',
  'reservation.rejected',
  'reservation.cancelled',
];

// Singleton
let instance: Socket | null = null;

// Mini-emitter: Set<EventCallback> — sem biblioteca externa
const listeners = new Set<EventCallback>();

function registerSocketListeners(socket: Socket): void {
  // Registra socket.on 1× por evento — nunca acumula handlers
  EVENTS.forEach(ev => {
    socket.on(ev, (payload: ReservationEventPayload) => {
      listeners.forEach(cb => {
        try {
          cb(ev, payload);
        } catch (err) {
          // Isola falhas: exceção em um listener não interrompe os demais
          console.error('[Realtime] listener error:', ev, err);
        }
      });
    });
  });
}

export function getSocket(token: string): Socket {
  if (instance?.connected) return instance;

  // Desconecta instância anterior (token pode ter mudado)
  if (instance) {
    instance.disconnect();
    instance = null;
  }

  instance = io(`${API_BASE}/rooms`, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity, // explícito — robusto para Supabase free tier (Bug #1)
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 30_000, // backoff exponencial nativo do socket.io-client
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });

  registerSocketListeners(instance);
  return instance;
}

export function disconnectSocket(): void {
  instance?.disconnect();
  instance = null;
}

// Adiciona callback ao mini-emitter. Retorna unsubscribe.
export function subscribeToReservationEvents(cb: EventCallback): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
