import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { AdminListPayoutsQueryDto, RejectPayoutDto } from './dto/payout-request.dto';
import type {
  AdminPayoutRequestDto,
  PaginatedAdminPayoutsDto,
  PayoutReviewResultDto,
} from './dto/payout-response.dto';
import { PayoutsService } from './payouts.service';

/**
 * The withdrawal review queue.
 *
 * These are the only responses in the API that carry an instructor's bank
 * account number in full, because whoever is reading this screen is about to
 * type it into a banking app. Everywhere else it is masked.
 */
@Roles(Role.ADMIN)
@Controller('admin/payouts')
export class AdminPayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get()
  list(@Query() query: AdminListPayoutsQueryDto): Promise<PaginatedAdminPayoutsDto> {
    return this.payouts.listForAdmin(query);
  }

  @Get(':id')
  read(@Param('id') id: string): Promise<AdminPayoutRequestDto> {
    return this.payouts.readForAdmin(id);
  }

  /** The transfer has been made. The held money leaves the platform. */
  @Patch(':id/approve')
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PayoutReviewResultDto> {
    return this.payouts.approve(id, user.id);
  }

  /** Refused. The held money goes back to the instructor's wallet. */
  @Patch(':id/reject')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectPayoutDto,
  ): Promise<PayoutReviewResultDto> {
    return this.payouts.reject(id, user.id, dto.note);
  }
}
