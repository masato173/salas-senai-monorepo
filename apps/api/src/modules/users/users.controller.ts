import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ListUsersQueryDto } from './dtos/list-users-query.dto';
import { UpdateRoleDto } from './dtos/update-role.dto';
import { UpdateActiveDto } from './dtos/update-active.dto';
import type { UserPublicDto } from './dtos/user-public.dto';
import type { PaginatedResult } from './users.service';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

interface AuthenticatedRequest {
  user: RequestUser;
}

@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  listUsers(@Query() query: ListUsersQueryDto): Promise<PaginatedResult<UserPublicDto>> {
    return this.usersService.listUsers({
      ...(query.role !== undefined ? { role: query.role } : {}),
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  // CRÍTICO: 'professors' declarado ANTES de qualquer futura rota :id neste
  // controller, mesmo padrão de rooms.controller.ts (admin/all vs :id).
  // Hoje não há conflito real (não existe @Get(':id') aqui), mas mantém o
  // hábito do projeto de rota estática antes de dinâmica.
  @Roles(Role.COORDENADOR, Role.ADMIN)
  @Get('professors')
  listProfessors(): Promise<UserPublicDto[]> {
    return this.usersService.listProfessors();
  }

  @Patch(':id/role')
  @HttpCode(HttpStatus.OK)
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<UserPublicDto> {
    return this.usersService.updateRole(id, dto.role, req.user);
  }

  @Patch(':id/active')
  @HttpCode(HttpStatus.OK)
  setActive(
    @Param('id') id: string,
    @Body() dto: UpdateActiveDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<UserPublicDto> {
    return this.usersService.setActive(id, dto.isActive, req.user);
  }
}
