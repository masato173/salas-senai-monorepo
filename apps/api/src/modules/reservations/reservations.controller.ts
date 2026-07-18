import {
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
import { ReservationsService } from './reservations.service';
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
    @Request() req?: AuthenticatedRequest,
  ): Promise<Reservation[]> {
    const currentUser = req!.user;
    const resolvedStatus =
      status !== undefined && Object.values(ReservationStatus).includes(status as ReservationStatus)
        ? (status as ReservationStatus)
        : undefined;

    return this.reservationsService.findAll({
      roomId,
      date,
      status: resolvedStatus,
      mine: mine === 'true',
      currentUser,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Reservation> {
    return this.reservationsService.findOne(id);
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
  ) {
    return this.reservationsService.updateGroup({ ...dto, groupId }, req.user);
  }

  @Patch('selected')
  @HttpCode(HttpStatus.OK)
  updateSelected(@Body() dto: UpdateReservationSelectedDto, @Request() req: AuthenticatedRequest) {
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
