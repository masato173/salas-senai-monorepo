import { Controller, Post, HttpCode, HttpStatus, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { SyncService } from './sync.service';
import type { SyncResult } from '@salas-senai/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  // Sincronização manual — ADMIN only.
  // Cron periódico pode ser adicionado futuramente sem alterar este endpoint.
  @Roles(Role.ADMIN)
  @Post('schedules')
  @HttpCode(HttpStatus.OK)
  syncSchedules(@Req() req: Request): Promise<SyncResult> {
    const user = req.user as RequestUser;
    return this.syncService.syncSchedules(user.userId);
  }
}
