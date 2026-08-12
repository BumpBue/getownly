import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import type { TopupReviewResultDto } from '@/modules/ledger/dto/ledger-response.dto';
import { AdminListTopupsQueryDto, RejectTopupDto } from './dto/topup-request.dto';
import type { PaginatedAdminTopupsDto } from './dto/topup-response.dto';
import { TopupsService } from './topups.service';

/**
 * The slip review queue. Approving one is the only way money enters the
 * platform, so the whole controller is behind ADMIN and nothing else.
 */
@Roles(Role.ADMIN)
@Controller('admin/topups')
export class AdminTopupsController {
  constructor(private readonly topups: TopupsService) {}

  @Get()
  list(@Query() query: AdminListTopupsQueryDto): Promise<PaginatedAdminTopupsDto> {
    return this.topups.listForAdmin(query);
  }

  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<TopupReviewResultDto> {
    return this.topups.approve(id, admin);
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: RejectTopupDto,
  ): Promise<TopupReviewResultDto> {
    return this.topups.reject(id, admin, dto.note);
  }
}
