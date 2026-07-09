import { Injectable } from '@nestjs/common';
import type { Reservation } from '@prisma/client';
import { RealtimeGateway } from './realtime.gateway';

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
      this.gateway.server.emit(event, payload);
    } catch (e) {
      // Falha no WS nunca propaga para a transação da reserva
      // eslint-disable-next-line no-console
      console.error('[Realtime] Emit failed:', event, e);
    }
  }
}
