import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReservationStatus, Role } from '@prisma/client';
import { ReservationsService, type DayReservationItem } from './reservations.service';
import { UpdateReservationDto } from './dtos/update-reservation.dto';
import { UpdateStatusDto } from './dtos/update-status.dto';
import { UpdateReservationGroupDto } from './dtos/update-reservation-group.dto';
import { UpdateReservationSelectedDto } from './dtos/update-reservation-selected.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import type { Reservation } from '@prisma/client';
import { CreateReservationDto } from './dtos/create-reservation.dto';
import { CreateReservationRangeDto } from './dtos/create-reservation-range.dto';

interface AuthenticatedRequest {
  user: RequestUser;
}

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  findAll(
    @Query('roomId') roomId?: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('mine') mine?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Request() req?: AuthenticatedRequest,
  ): Promise<Reservation[]> {
    const currentUser = req!.user;
    const resolvedStatus =
      status !== undefined && Object.values(ReservationStatus).includes(status as ReservationStatus)
        ? (status as ReservationStatus)
        : undefined;

    // page/pageSize: só números inteiros positivos viram parâmetro válido —
    // qualquer outra coisa (ausente, malformado, negativo) vira undefined e
    // o service cai no comportamento padrão sem paginação.
    const resolvedPage = page !== undefined && /^\d+$/.test(page) ? Number(page) : undefined;
    const resolvedPageSize =
      pageSize !== undefined && /^\d+$/.test(pageSize) ? Number(pageSize) : undefined;

    return this.reservationsService.findAll({
      roomId,
      date,
      status: resolvedStatus,
      mine: mine === 'true',
      page: resolvedPage,
      pageSize: resolvedPageSize,
      currentUser,
    });
  }

  // day ANTES de :id (mesmo padrão de POST /reservations/range) — senão
  // ':id' captura "day" como se fosse um id de reserva.
  @Get('day')
  findByDay(
    @Query('date') date: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<DayReservationItem[]> {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date deve estar no formato YYYY-MM-DD.');
    }
    return this.reservationsService.findByDay(date, req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest): Promise<Reservation> {
    return this.reservationsService.findOne(id, req.user);
  }

  @Roles(Role.PROFESSOR, Role.COORDENADOR, Role.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateReservationDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<Reservation> {
    return this.reservationsService.create(dto, req.user);
  }

  @Roles(Role.PROFESSOR, Role.COORDENADOR, Role.ADMIN)
  @Post('range')
  @HttpCode(HttpStatus.CREATED)
  createRange(
    @Body() dto: CreateReservationRangeDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ count: number; reservations: Reservation[] }> {
    return this.reservationsService.createRange(dto, req.user);
  }

  // CRÍTICO: :id/status declarado ANTES de :id para evitar captura pelo param
  @Roles(Role.COORDENADOR, Role.ADMIN)
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<Reservation> {
    return this.reservationsService.updateStatus(id, dto.status, req.user);
  }

  @Patch('group/:groupId')
  @HttpCode(HttpStatus.OK)
  updateGroup(
    @Param('groupId') groupId: string,
    @Body() dto: UpdateReservationGroupDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ count: number; reservations: Reservation[] }> {
    return this.reservationsService.updateGroup({ ...dto, groupId }, req.user);
  }

  @Patch('selected')
  @HttpCode(HttpStatus.OK)
  updateSelected(
    @Body() dto: UpdateReservationSelectedDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ count: number; reservations: Reservation[] }> {
    return this.reservationsService.updateSelected(dto, req.user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<Reservation> {
    return this.reservationsService.update(id, dto, req.user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Request() req: AuthenticatedRequest): Promise<Reservation> {
    return this.reservationsService.cancel(id, req.user);
  }
}
