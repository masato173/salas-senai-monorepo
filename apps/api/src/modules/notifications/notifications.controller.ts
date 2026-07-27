import { Controller, Get, Patch, Param, Query, Request } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

interface AuthenticatedRequest {
  user: RequestUser;
}

// Sem @Roles(...) — qualquer role autenticada passa livre no RolesGuard
// (mesma convenção de PATCH /reservations/:id). Sempre usa o userId do
// token (req.user), nunca de query param — nunca lista/altera notificação
// de outro usuário.
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(
    @Query('unreadOnly') unreadOnly: string | undefined,
    @Request() req: AuthenticatedRequest,
  ): Promise<Notification[]> {
    return this.notificationsService.findForUser(req.user.userId, {
      unreadOnly: unreadOnly === 'true',
    });
  }

  // Estático antes de dinâmico — mesmo hábito de GET /users/professors.
  @Patch('read-all')
  markAllRead(@Request() req: AuthenticatedRequest): Promise<{ count: number }> {
    return this.notificationsService.markAllRead(req.user.userId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Request() req: AuthenticatedRequest): Promise<Notification> {
    return this.notificationsService.markRead(id, req.user.userId);
  }
}
