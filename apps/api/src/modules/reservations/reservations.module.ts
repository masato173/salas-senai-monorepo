import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { ConflictService } from './conflict.service';
import { OwnershipService } from './ownership.service';
import { AuditService } from './audit/audit.service';

@Module({
  controllers: [ReservationsController],
  providers: [ReservationsService, ConflictService, OwnershipService, AuditService],
  exports: [ConflictService],
})
export class ReservationsModule {}
