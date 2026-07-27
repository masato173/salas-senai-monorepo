import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// Não-global (padrão de AuditModule, não de RealtimeModule) — quem precisa
// de NotificationsService importa este módulo explicitamente (ver
// ReservationsModule). RealtimeService já é @Global(), disponível aqui sem
// import extra.
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
