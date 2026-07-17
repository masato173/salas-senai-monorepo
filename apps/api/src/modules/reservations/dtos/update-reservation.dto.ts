import { IsString, IsNotEmpty, IsOptional, Matches, MaxLength } from 'class-validator';

export class UpdateReservationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  roomId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date deve estar no formato YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'inicio deve estar no formato HH:MM' })
  inicio?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'fim deve estar no formato HH:MM' })
  fim?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  turma?: string;
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
