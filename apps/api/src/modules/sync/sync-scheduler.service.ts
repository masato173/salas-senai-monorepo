import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SyncService } from './sync.service';
import { UsersRepository } from '../users/users.repository';
import { Role } from '@prisma/client';

// ─────────────────────────────────────────────────────────────
// SyncSchedulerService — F7.2
//
// Responsável pelo cron de sincronização automática de aulas.
// Separado do SyncService para manter a responsabilidade única:
//   SyncService      → lógica de sync (manual ou automático)
//   SyncScheduler    → agendamento via @Cron
//
// Cron: diariamente às 03:00 (horário do servidor — UTC).
// Em produção no Supabase (São Paulo, UTC-3) = 00:00 BRT.
//
// userId para auditoria: primeiro ADMIN ativo encontrado no banco.
// Se não houver ADMIN ativo, o cron é pulado e log de warning é emitido.
// ─────────────────────────────────────────────────────────────

@Injectable()
export class SyncSchedulerService {
  private readonly logger = new Logger(SyncSchedulerService.name);

  constructor(
    private readonly syncService: SyncService,
    private readonly usersRepository: UsersRepository,
  ) {}

  // Diariamente às 03:00 UTC (00:00 BRT / Manaus)
  // Para alterar a frequência: trocar por '0 */6 * * *' (a cada 6h)
  // ou '0 3 * * 1' (toda segunda-feira às 03:00)
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailySync(): Promise<void> {
    this.logger.log('Cron de sync iniciado.');

    // Busca o primeiro ADMIN ativo para registrar na auditoria
    const adminUser = await this.findFirstAdmin();
    if (adminUser === null) {
      this.logger.warn('Cron de sync: nenhum usuário ADMIN ativo encontrado. Sync pulado.');
      return;
    }

    try {
      const result = await this.syncService.syncSchedules(adminUser.id);
      this.logger.log(
        `Cron de sync concluído: ${result.synced} registros em ${result.duration}ms (syncId: ${result.syncId}).`,
      );
    } catch (err) {
      // Não relança — cron não deve crashar o processo
      this.logger.error(`Cron de sync falhou: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async findFirstAdmin(): Promise<{ id: string } | null> {
    // FindAllResult retorna { users, total } — campo correto é 'users'
    const { users } = await this.usersRepository.findAll({
      role: Role.ADMIN,
      isActive: true,
      page: 1,
      limit: 1,
    });
    return users[0] !== undefined ? { id: users[0].id } : null;
  }
}
