import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationType, ReservationStatus } from '@prisma/client';
import {
  ReservationReminderService,
  isWithinReminderWindow,
} from '../reservation-reminder.service';

// ─── isWithinReminderWindow — função pura, sem cron/Prisma ────────────────

describe('isWithinReminderWindow', () => {
  const nowMinutes = 10 * 60; // 10:00

  it('reserva que começa em 30 min — dentro da janela, deve lembrar', () => {
    expect(isWithinReminderWindow(nowMinutes + 30, nowMinutes, 60)).toBe(true);
  });

  it('reserva que já começou (mesmo minuto de agora) — fora da janela, não lembra', () => {
    expect(isWithinReminderWindow(nowMinutes, nowMinutes, 60)).toBe(false);
  });

  it('reserva que já começou há 5 min — fora da janela, não lembra', () => {
    expect(isWithinReminderWindow(nowMinutes - 5, nowMinutes, 60)).toBe(false);
  });

  it('reserva que começa em 2 horas — fora da janela ainda, não lembra', () => {
    expect(isWithinReminderWindow(nowMinutes + 120, nowMinutes, 60)).toBe(false);
  });

  it('reserva que começa exatamente no limite da janela (60 min) — ainda dentro (<=)', () => {
    expect(isWithinReminderWindow(nowMinutes + 60, nowMinutes, 60)).toBe(true);
  });
});

// ─── sendUpcomingReminders() — mocks de Prisma/NotificationsService ───────

const mockPrisma = {
  reservation: { findMany: vi.fn() },
  notification: { findFirst: vi.fn() },
};
const mockNotificationsService = { notify: vi.fn() };

function makeService(): ReservationReminderService {
  return new ReservationReminderService(mockPrisma as never, mockNotificationsService as never);
}

function makeReservation(overrides: { id?: string; inicio?: string; userId?: string }) {
  return {
    id: overrides.id ?? 'res-1',
    userId: overrides.userId ?? 'prof-1',
    roomId: 'room-1',
    date: '2026-08-10',
    inicio: overrides.inicio ?? '10:30',
    fim: '12:00',
    status: ReservationStatus.APPROVED,
    room: { name: '01 Sala' },
  };
}

describe('ReservationReminderService.sendUpcomingReminders()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // "Agora" real (UTC) = 2026-08-10T14:00:00Z → Manaus (UTC-4) = 10:00,
    // mesmo dia. Mesma técnica de deslocamento usada no service.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T14:00:00.000Z'));
    mockNotificationsService.notify.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('busca reservas do dia (Manaus) com status APPROVED e deletedAt null', async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([]);

    await makeService().sendUpcomingReminders();

    expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: '2026-08-10',
          status: ReservationStatus.APPROVED,
          deletedAt: null,
        }),
      }),
    );
  });

  it('reserva dentro da janela sem lembrete ainda — cria notificação RESERVATION_REMINDER pro dono', async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([
      makeReservation({ inicio: '10:30', userId: 'prof-1' }), // começa em 30min
    ]);
    mockPrisma.notification.findFirst.mockResolvedValue(null);

    await makeService().sendUpcomingReminders();

    expect(mockNotificationsService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'prof-1',
        type: NotificationType.RESERVATION_REMINDER,
        reservationId: 'res-1',
      }),
    );
  });

  it('reserva fora da janela (começa em 2h) — não cria notificação', async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([makeReservation({ inicio: '12:00' })]);

    await makeService().sendUpcomingReminders();

    expect(mockPrisma.notification.findFirst).not.toHaveBeenCalled();
    expect(mockNotificationsService.notify).not.toHaveBeenCalled();
  });

  it('idempotência — reserva que já tem lembrete enviado NÃO gera um segundo', async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([makeReservation({ inicio: '10:30' })]);
    mockPrisma.notification.findFirst.mockResolvedValue({ id: 'notif-existente' });

    await makeService().sendUpcomingReminders();

    expect(mockPrisma.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reservationId: 'res-1', type: NotificationType.RESERVATION_REMINDER },
      }),
    );
    expect(mockNotificationsService.notify).not.toHaveBeenCalled();
  });

  it('isolamento de falha — uma reserva que lança erro não impede o processamento das outras', async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([
      makeReservation({ id: 'res-a', inicio: '10:30' }),
      makeReservation({ id: 'res-b', inicio: '10:45' }),
    ]);
    mockPrisma.notification.findFirst.mockResolvedValue(null);
    mockNotificationsService.notify
      .mockRejectedValueOnce(new Error('falha simulada'))
      .mockResolvedValueOnce(undefined);

    await makeService().sendUpcomingReminders();

    expect(mockNotificationsService.notify).toHaveBeenCalledTimes(2);
  });
});
