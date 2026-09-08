import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CreatePayoutDto, ListPayoutsQueryDto, SaveBankAccountDto } from './dto/payout-request.dto';
import type {
  BankAccountDto,
  PaginatedPayoutsDto,
  PayoutOverviewDto,
  PayoutReviewResultDto,
} from './dto/payout-response.dto';
import { PayoutsService } from './payouts.service';

/**
 * An instructor withdrawing their earnings.
 *
 * INSTRUCTOR only. Students have nothing to withdraw — money reaches a student
 * wallet by top-up and leaves it by purchase — and admins are the ones who
 * approve these, so an account that could do both sides of a transfer is
 * exactly what this manual flow must not allow (CLAUDE.md, ข้อห้าม 6).
 */
@Roles(Role.INSTRUCTOR)
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  /** Balance, the pending request if any, and the saved bank details. */
  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser): Promise<PayoutOverviewDto> {
    return this.payouts.overview(user.id);
  }

  /**
   * The caller's own bank details, with the account number in full.
   *
   * `user.id` comes from the JWT, never from the request, so there is no shape
   * of this call that reads somebody else's number.
   */
  @Get('bank-account')
  readBankAccount(@CurrentUser() user: AuthenticatedUser): Promise<BankAccountDto | null> {
    return this.payouts.readBankAccount(user.id);
  }

  @Put('bank-account')
  saveBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveBankAccountDto,
  ): Promise<BankAccountDto> {
    return this.payouts.saveBankAccount(user.id, dto);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePayoutDto,
  ): Promise<PayoutReviewResultDto> {
    return this.payouts.create(user.id, dto);
  }

  @Get('mine')
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPayoutsQueryDto,
  ): Promise<PaginatedPayoutsDto> {
    return this.payouts.listMine(user.id, query);
  }

  /** Withdraws a request nobody has reviewed yet, returning the money. */
  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PayoutReviewResultDto> {
    return this.payouts.cancel(id, user.id);
  }
}
