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

// Fase C2 — notificação persistente. Payload mínimo já traz title/body
// prontos (ver NotificationEventPayload no backend, realtime.service.ts) —
// frontend não precisa montar mensagem nem fazer query extra.
export type NotificationEvent = 'notification.created';

export type NotificationTypeValue =
  | 'RESERVATION_PENDING'
  | 'RESERVATION_CONFIRMED'
  | 'RESERVATION_REJECTED'
  | 'RESERVATION_CANCELLED'
  | 'RESERVATION_RESCHEDULED'
  | 'RESERVATION_REMINDER';

export interface NotificationEventPayload {
  id: string;
  type: NotificationTypeValue;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

type NotificationEventCallback = (payload: NotificationEventPayload) => void;

// Sinal de ocupação (Issue 5, A4) — vai pra TODOS os sockets, sem dado de
// pessoa. Os eventos reservation.* completos agora só chegam ao dono e aos
// coordenadores; telas de ocupação (Dashboard) escutam este aqui.
export interface OccupancyChangedPayload {
  roomId: string;
  date: string; // YYYY-MM-DD
}

type OccupancyEventCallback = (payload: OccupancyChangedPayload) => void;

// Singleton
let instance: Socket | null = null;

// Mini-emitter: Set<EventCallback> — sem biblioteca externa
const listeners = new Set<EventCallback>();

// Segundo mini-emitter, em paralelo ao de reserva — mesmo padrão (Set +
// subscribe/unsubscribe), mas tipado separado. Decisão consciente: o
// mini-emitter de reserva é fortemente tipado só pra ReservationEvent;
// generalizar os dois num só exigiria um union type tocando o código já
// em produção — menor risco manter dois emitters paralelos e idênticos
// em espírito do que arriscar o existente.
const notificationListeners = new Set<NotificationEventCallback>();

// Terceiro mini-emitter, mesmo padrão dos dois acima.
const occupancyListeners = new Set<OccupancyEventCallback>();

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

  socket.on('notification.created', (payload: NotificationEventPayload) => {
    notificationListeners.forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.error('[Realtime] notification listener error:', err);
      }
    });
  });

  socket.on('occupancy.changed', (payload: OccupancyChangedPayload) => {
    occupancyListeners.forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.error('[Realtime] occupancy listener error:', err);
      }
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

// Mesmo padrão — mini-emitter separado pra notification.created (Fase C2).
export function subscribeToNotificationEvents(cb: NotificationEventCallback): () => void {
  notificationListeners.add(cb);
  return () => {
    notificationListeners.delete(cb);
  };
}

// Mesmo padrão — mini-emitter separado pra occupancy.changed (Issue 5, A4).
export function subscribeToOccupancyEvents(cb: OccupancyEventCallback): () => void {
  occupancyListeners.add(cb);
  return () => {
    occupancyListeners.delete(cb);
  };
}
