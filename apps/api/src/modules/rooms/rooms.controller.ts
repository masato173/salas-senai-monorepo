import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dtos/create-room.dto';
import { UpdateRoomDto } from './dtos/update-room.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Public()
  @Get()
  findAll(): Promise<import('@prisma/client').Room[]> {
    return this.roomsService.findAll();
  }

  // CRÍTICO: admin/all declarado ANTES de :id para evitar captura pelo parâmetro
  @Roles(Role.ADMIN)
  @Get('admin/all')
  findAllAdmin(): Promise<import('@prisma/client').Room[]> {
    return this.roomsService.findAllAdmin();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string): Promise<import('@prisma/client').Room> {
    return this.roomsService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateRoomDto): Promise<import('@prisma/client').Room> {
    return this.roomsService.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
  ): Promise<import('@prisma/client').Room> {
    return this.roomsService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  softDelete(@Param('id') id: string): Promise<import('@prisma/client').Room> {
    return this.roomsService.softDelete(id);
  }
}
