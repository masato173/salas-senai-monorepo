import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReservationStatus } from '@prisma/client';
import { RealtimeService } from '../realtime.service';
import { COORDINATORS_ROOM } from '../realtime.gateway';

// server.to(room) devolve um "BroadcastOperator" encadeável. O mock guarda a
// lista de rooms de cada cadeia e o emit final, pra conferir o destino real.
type Emitted = { rooms: string[]; event: string; payload: unknown };

function makeServer() {
  const emitted: Emitted[] = [];
  const globalEmits: { event: string; payload: unknown }[] = [];

  function chain(rooms: string[]) {
    return {
      to: (room: string) => chain([...rooms, room]),
      emit: (event: string, payload: unknown) => {
        emitted.push({ rooms, event, payload });
        return true;
      },
    };
  }

  const server = {
    to: vi.fn((room: string) => chain([room])),
    emit: vi.fn((event: string, payload: unknown) => {
      globalEmits.push({ event, payload });
      return true;
    }),
  };
  return { server, emitted, globalEmits };
}

const RESERVATION = {
  id: 'res-1',
  roomId: 'room-1',
  userId: 'prof-1',
  date: '2026-07-10',
  inicio: '08:00',
  fim: '10:00',
  status: ReservationStatus.PENDING,
  notes: 'nota privada',
  turma: 'APB.ADM.148',
} as never;

describe('RealtimeService — destino dos eventos (Issue 5, A4)', () => {
  let ctx: ReturnType<typeof makeServer>;
  let service: RealtimeService;

  beforeEach(() => {
    ctx = makeServer();
    service = new RealtimeService({ server: ctx.server } as never);
  });

  it('evento completo de reserva vai só pro dono + room de coordenadores', () => {
    service.reservationCreated(RESERVATION);

    const full = ctx.emitted.filter(e => e.event === 'reservation.created');
    expect(full).toHaveLength(1);
    expect(full[0].rooms).toEqual(['prof-1', COORDINATORS_ROOM]);
    expect(full[0].payload).toMatchObject({ userId: 'prof-1', status: 'PENDING' });
  });

  it('o payload completo NUNCA sai em broadcast global', () => {
    service.reservationCreated(RESERVATION);
    service.reservationApproved(RESERVATION);
    service.reservationCancelled(RESERVATION);

    expect(ctx.globalEmits.map(e => e.event)).not.toContain('reservation.created');
    expect(ctx.globalEmits.every(e => e.event === 'occupancy.changed')).toBe(true);
  });

  it("broadcast 'occupancy.changed' leva exatamente { roomId, date } — sem dado de pessoa", () => {
    service.reservationUpdated(RESERVATION);

    expect(ctx.globalEmits).toEqual([
      { event: 'occupancy.changed', payload: { roomId: 'room-1', date: '2026-07-10' } },
    ]);
  });

  it('cada um dos 5 eventos de reserva gera o par (completo direcionado + ocupação)', () => {
    service.reservationCreated(RESERVATION);
    service.reservationUpdated(RESERVATION);
    service.reservationApproved(RESERVATION);
    service.reservationRejected(RESERVATION);
    service.reservationCancelled(RESERVATION);

    expect(ctx.emitted).toHaveLength(5);
    expect(ctx.emitted.every(e => e.rooms.join() === `prof-1,${COORDINATORS_ROOM}`)).toBe(true);
    expect(ctx.globalEmits).toHaveLength(5);
  });

  it('notificationCreated continua indo só pra room do próprio usuário', () => {
    service.notificationCreated('prof-1', {
      id: 'n1',
      type: 'RESERVATION_CONFIRMED',
      title: 't',
      body: 'b',
      createdAt: '2026-07-10T00:00:00.000Z',
      read: false,
    });

    expect(ctx.emitted).toEqual([
      expect.objectContaining({ rooms: ['prof-1'], event: 'notification.created' }),
    ]);
    expect(ctx.globalEmits).toHaveLength(0);
  });

  it('falha no emit não propaga pra quem chamou', () => {
    ctx.server.to.mockImplementation(() => {
      throw new Error('socket caiu');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => service.reservationCreated(RESERVATION)).not.toThrow();
  });
});
