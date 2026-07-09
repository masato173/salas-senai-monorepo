import { IsIn } from 'class-validator';
import { ReservationStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsIn([ReservationStatus.APPROVED, ReservationStatus.REJECTED], {
    message: 'status deve ser APPROVED ou REJECTED.',
  })
  status!: ReservationStatus;
}
