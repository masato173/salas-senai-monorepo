import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min, MaxLength } from 'class-validator';
import { RoomType } from '@prisma/client';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsEnum(RoomType)
  type!: RoomType;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  floor?: number;
}
