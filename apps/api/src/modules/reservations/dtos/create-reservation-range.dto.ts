import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  IsInt,
  Min,
  Max,
  IsOptional,
  MaxLength,
  Matches,
  Validate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsNotPastDateConstraint } from '../validators/is-not-past-date.validator';

export class CreateReservationRangeDto {
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateInicio deve estar no formato YYYY-MM-DD' })
  @Validate(IsNotPastDateConstraint)
  dateInicio!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateFim deve estar no formato YYYY-MM-DD' })
  dateFim!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @Type(() => Number)
  diasSemana!: number[];

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
}
