import {
  IsString,
  IsArray,
  ArrayMinSize,
  IsOptional,
  Matches,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
export class UpdateReservationSelectedDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids!: string[];
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  roomId?: string;
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
