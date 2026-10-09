import {
  IsString,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsOptional,
  Matches,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

// #22 / ADR-007 — o lote roda numa única transação (lock por (sala, data) de
// todos os itens). Mesmo teto do createRange, para limitar a duração da tx.
export const UPDATE_SELECTED_MAX_IDS = 60;

export class UpdateReservationSelectedDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(UPDATE_SELECTED_MAX_IDS, {
    message: `Selecione no máximo ${UPDATE_SELECTED_MAX_IDS} reservas por vez.`,
  })
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
