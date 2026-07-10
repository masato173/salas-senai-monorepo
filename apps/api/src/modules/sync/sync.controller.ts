import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SyncService } from './sync.service';
import type { SyncResult } from './sync.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  // Sincronização manual — ADMIN only.
  // Cron periódico pode ser adicionado futuramente sem alterar este endpoint.
  @Roles(Role.ADMIN)
  @Post('schedules')
  @HttpCode(HttpStatus.OK)
  syncSchedules(): Promise<SyncResult> {
    return this.syncService.syncSchedules();
  }
}
