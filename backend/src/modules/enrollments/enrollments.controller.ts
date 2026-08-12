import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import type { PurchaseResultDto } from '@/modules/ledger/dto/ledger-response.dto';
import { WalletService } from '@/modules/ledger/wallet.service';
import type { MyEnrollmentDto } from './dto/enrollment-response.dto';
import { EnrollmentsService } from './enrollments.service';

/**
 * Buying a course and listing what has been bought.
 *
 * The two routes sit under different roots (`/courses/:id/purchase` and
 * `/enrollments/mine`) because that is where each one reads best from the
 * client's side, so the paths are spelled out rather than sharing a prefix.
 *
 * ADMIN is excluded: an admin approves the top-ups that fund these purchases.
 */
@Roles(Role.STUDENT, Role.INSTRUCTOR)
@Controller()
export class EnrollmentsController {
  constructor(
    private readonly enrollments: EnrollmentsService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * Pays for a course out of the wallet.
   *
   * Only the course id is accepted. The price, the commission rate and the
   * buyer all come from the database and the token — never from the body
   * (CLAUDE.md, ข้อห้าม 7).
   */
  @HttpCode(HttpStatus.CREATED)
  @Post('courses/:id/purchase')
  purchase(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PurchaseResultDto> {
    return this.wallet.purchaseCourse(user.id, courseId);
  }

  @Get('enrollments/mine')
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<MyEnrollmentDto[]> {
    return this.enrollments.listMine(user.id);
  }
}
