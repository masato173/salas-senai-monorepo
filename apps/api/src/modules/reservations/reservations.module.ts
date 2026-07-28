import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { ConflictService } from './conflict.service';
import { OwnershipService } from './ownership.service';
import { AuditService } from './audit/audit.service';
import { ReservationReminderService } from './reservation-reminder.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ReservationsController],
  providers: [
    ReservationsService,
    ConflictService,
    OwnershipService,
    AuditService,
    ReservationReminderService,
  ],
  exports: [ConflictService, AuditService],
})
export class ReservationsModule {}
