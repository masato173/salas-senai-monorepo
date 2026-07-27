import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications.service';

const mockPrisma = {
  notification: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

const mockRealtimeService = { notificationCreated: vi.fn() };

function makeService(): NotificationsService {
  return new NotificationsService(mockPrisma as never, mockRealtimeService as never);
}

const baseNotification = {
  id: 'notif-1',
  userId: 'user-1',
  reservationId: 'res-1',
  type: NotificationType.RESERVATION_PENDING,
  title: 'Nova reserva aguardando aprovação',
  body: 'Prof. Silva solicitou 01 Sala em 2026-08-10, 08:00–10:00.',
  read: false,
  createdAt: new Date('2026-08-01T12:00:00Z'),
};

describe('NotificationsService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('notify()', () => {
    it('persiste no banco e emite via WebSocket pro destinatário', async () => {
      mockPrisma.notification.create.mockResolvedValue(baseNotification);

      const result = await makeService().notify({
        userId: 'user-1',
        type: NotificationType.RESERVATION_PENDING,
        title: baseNotification.title,
        body: baseNotification.body,
        reservationId: 'res-1',
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            type: NotificationType.RESERVATION_PENDING,
            reservationId: 'res-1',
          }),
        }),
      );
      expect(mockRealtimeService.notificationCreated).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ id: 'notif-1', title: baseNotification.title }),
      );
      expect(result).toEqual(baseNotification);
    });

    it('omite reservationId do create() quando não informado (spread condicional)', async () => {
      mockPrisma.notification.create.mockResolvedValue({
        ...baseNotification,
        reservationId: null,
      });

      await makeService().notify({
        userId: 'user-1',
        type: NotificationType.RESERVATION_PENDING,
        title: 't',
        body: 'b',
      });

      const callArgs = mockPrisma.notification.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect('reservationId' in callArgs.data).toBe(false);
    });
  });

  describe('notifyMany()', () => {
    it('notifica cada userId independentemente', async () => {
      mockPrisma.notification.create.mockResolvedValue(baseNotification);

      await makeService().notifyMany(['user-1', 'user-2'], {
        type: NotificationType.RESERVATION_PENDING,
        title: 't',
        body: 'b',
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
      expect(mockRealtimeService.notificationCreated).toHaveBeenCalledTimes(2);
    });

    it('uma falha isolada não impede a notificação dos demais usuários', async () => {
      mockPrisma.notification.create
        .mockRejectedValueOnce(new Error('falha simulada'))
        .mockResolvedValueOnce(baseNotification);

      await makeService().notifyMany(['user-1', 'user-2'], {
        type: NotificationType.RESERVATION_PENDING,
        title: 't',
        body: 'b',
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
      expect(mockRealtimeService.notificationCreated).toHaveBeenCalledTimes(1);
    });
  });

  describe('markRead()', () => {
    it('lança NotFoundException quando a notificação não existe', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);
      await expect(makeService().markRead('nao-existe', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança ForbiddenException quando a notificação pertence a outro usuário', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(baseNotification);
      await expect(makeService().markRead('notif-1', 'outro-user')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    });

    it('marca como lida com sucesso quando o dono é quem pede', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(baseNotification);
      mockPrisma.notification.update.mockResolvedValue({ ...baseNotification, read: true });

      const result = await makeService().markRead('notif-1', 'user-1');

      expect(result.read).toBe(true);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { read: true },
      });
    });
  });

  describe('markAllRead()', () => {
    it('marca todas as não-lidas do usuário e retorna a contagem', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await makeService().markAllRead('user-1');

      expect(result).toEqual({ count: 3 });
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        data: { read: true },
      });
    });
  });
});
