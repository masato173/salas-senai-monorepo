import { Injectable } from '@nestjs/common';
import type { Reservation, NotificationType } from '@prisma/client';
import { RealtimeGateway, COORDINATORS_ROOM } from './realtime.gateway';

// Payload mínimo — sem campos sensíveis do usuário (passwordHash etc.)
type ReservationEventPayload = Pick<
  Reservation,
  'id' | 'roomId' | 'userId' | 'date' | 'inicio' | 'fim' | 'status'
>;

type ReservationEvent =
  | 'reservation.created'
  | 'reservation.updated'
  | 'reservation.approved'
  | 'reservation.rejected'
  | 'reservation.cancelled';

// Sinal de "a ocupação dessa sala/dia mudou", sem nenhum dado de pessoa.
// roomId + date já são públicos via GET /availability.
export interface OccupancyChangedPayload {
  roomId: string;
  date: string;
}

// Fase C2 — payload mínimo pro frontend renderizar a notificação sem
// query extra (title/body já vêm prontos, decidido na criação).
export interface NotificationEventPayload {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

// Intermediário entre ReservationsService e RealtimeGateway.
// Falha no emit nunca afeta a transação da reserva (try/catch interno).
// ReservationsService não conhece o Gateway diretamente.
@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  reservationCreated(reservation: Reservation): void {
    this.emit('reservation.created', reservation);
  }

  reservationUpdated(reservation: Reservation): void {
    this.emit('reservation.updated', reservation);
  }

  reservationApproved(reservation: Reservation): void {
    this.emit('reservation.approved', reservation);
  }

  reservationRejected(reservation: Reservation): void {
    this.emit('reservation.rejected', reservation);
  }

  reservationCancelled(reservation: Reservation): void {
    this.emit('reservation.cancelled', reservation);
  }

  // Fase C2 — emite DIRECIONADO (server.to(userId), não broadcast global)
  // pra room nomeada com o userId (ver RealtimeGateway.handleConnection).
  // Mesmo isolamento de falha do emit() de reserva abaixo — nunca propaga
  // erro pra quem chamou (NotificationsService.notify já persistiu no
  // banco antes disso; falha aqui não desfaz a criação).
  notificationCreated(userId: string, payload: NotificationEventPayload): void {
    try {
      this.gateway.server.to(userId).emit('notification.created', payload);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[Realtime] Emit failed: notification.created', e);
    }
  }

  // Dois destinos, nunca broadcast do payload completo:
  //  1. Evento completo (com userId) só pro dono + room de coordenadores —
  //     é o que Minha Agenda, Aprovações e os dots da sidebar consomem.
  //  2. 'occupancy.changed' com só { roomId, date } pra todo socket
  //     conectado — mantém o Dashboard de ocupação de qualquer usuário ao
  //     vivo (ele só faz refetch, não lê o payload).
  private emit(event: ReservationEvent, data: Reservation): void {
    try {
      const payload: ReservationEventPayload = {
        id: data.id,
        roomId: data.roomId,
        userId: data.userId,
        date: data.date,
        inicio: data.inicio,
        fim: data.fim,
        status: data.status,
      };
      this.gateway.server.to(data.userId).to(COORDINATORS_ROOM).emit(event, payload);
      const occupancy: OccupancyChangedPayload = { roomId: data.roomId, date: data.date };
      this.gateway.server.emit('occupancy.changed', occupancy);
    } catch (e) {
      // Falha no WS nunca propaga para a transação da reserva
      // eslint-disable-next-line no-console
      console.error('[Realtime] Emit failed:', event, e);
    }
  }
}
