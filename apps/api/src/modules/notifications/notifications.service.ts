import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import type { Notification, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

export interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  reservationId?: string;
}

// Notificação persistente (Fase C2) — coexiste com o indicador efêmero de
// sidebar (AppLayout.tsx, notifyPath), que não sobrevive a reload. Este
// serviço é o histórico completo: sobrevive a reload e a novo login.
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  // Cria UMA notificação e emite via WebSocket pro destinatário (room
  // nomeada com o userId — ver RealtimeGateway.handleConnection). Falha no
  // emit nunca impede a criação no banco (RealtimeService.notificationCreated
  // já isola essa falha internamente, mesmo padrão do emit() de reserva).
  async notify(params: NotifyParams): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        ...(params.reservationId !== undefined ? { reservationId: params.reservationId } : {}),
      },
    });

    this.realtimeService.notificationCreated(params.userId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      createdAt: notification.createdAt.toISOString(),
      read: notification.read,
    });

    return notification;
  }

  // Várias notificações independentes (ex: todos os COORDENADOR/ADMIN
  // ativos, no evento de reserva pendente). Criações independentes por
  // usuário, não uma única transação — uma falha isolada notificando um
  // usuário não deve impedir os demais de receberem a deles.
  async notifyMany(userIds: string[], params: Omit<NotifyParams, 'userId'>): Promise<void> {
    for (const userId of userIds) {
      try {
        await this.notify({ ...params, userId });
      } catch (e) {
        this.logger.warn(`Falha ao notificar usuário ${userId}: ${String(e)}`);
      }
    }
  }

  // Mais recentes primeiro. Sem join com Reservation/Room — title/body já
  // carregam toda a informação legível (decidido na criação da notificação).
  findForUser(userId: string, options: { unreadOnly?: boolean } = {}): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(options.unreadOnly === true ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Notificação "${id}" não encontrada.`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('Você não tem permissão para acessar esta notificação.');
    }
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { count: result.count };
  }
}
