import { IsString, IsNotEmpty, IsOptional, Matches, MaxLength, Validate } from 'class-validator';
import { IsNotPastDateConstraint } from '../validators/is-not-past-date.validator';

export class CreateReservationDto {
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date deve estar no formato YYYY-MM-DD' })
  @Validate(IsNotPastDateConstraint)
  date!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'inicio deve estar no formato HH:MM' })
  inicio!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'fim deve estar no formato HH:MM' })
  fim!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  turma?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  // Proxy: COORDENADOR/ADMIN podem criar em nome de um professor. Sem
  // validação de existência aqui — o service confirma via prisma.user
  // (ver ReservationsService.resolveOwnerUserId). PROFESSOR ignora este
  // campo mesmo se enviado.
  @IsOptional()
  @IsString()
  ownerUserId?: string;
}
