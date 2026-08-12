import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import {
  ListUsersQueryDto,
  UpdateCommissionDto,
  UpdateUserStatusDto,
} from './dto/user-request.dto';
import type { AdminUserDto, PaginatedAdminUsersDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

/**
 * User administration: who exists, who is suspended, and what share of a sale
 * each instructor keeps. All of it behind ADMIN and nothing else.
 */
@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto): Promise<PaginatedAdminUsersDto> {
    return this.users.listForAdmin(query);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<AdminUserDto> {
    return this.users.setStatus(id, admin, dto.status);
  }

  @Patch(':id/commission')
  setCommission(@Param('id') id: string, @Body() dto: UpdateCommissionDto): Promise<AdminUserDto> {
    return this.users.setCommissionRate(id, dto.commissionRate);
  }
}
