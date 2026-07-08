import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';
import { RoomType } from '@prisma/client';

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(RoomType)
  type?: RoomType;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  floor?: number;

  @IsOptional()
  @IsBoolean()
  available?: boolean;
}
