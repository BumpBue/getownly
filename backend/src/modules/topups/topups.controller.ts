import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CreateTopupDto, ListTopupsQueryDto, TopupQuoteRequestDto } from './dto/topup-request.dto';
import type { PaginatedTopupsDto, TopupQuoteDto, TopupRequestDto } from './dto/topup-response.dto';
import { TopupsService } from './topups.service';

/**
 * Topping a wallet up.
 *
 * ADMIN is left out on purpose: admins are the ones who approve these, and an
 * account that can do both sides of a transfer is the one thing this manual
 * flow must not allow (CLAUDE.md, ข้อห้าม 6).
 */
@Roles(Role.STUDENT, Role.INSTRUCTOR)
@Controller('topups')
export class TopupsController {
  constructor(private readonly topups: TopupsService) {}

  /** Draws a QR for an amount. Nothing is recorded until a slip arrives. */
  @HttpCode(HttpStatus.OK)
  @Post('quote')
  quote(@Body() dto: TopupQuoteRequestDto): Promise<TopupQuoteDto> {
    return this.topups.quote(dto);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTopupDto,
  ): Promise<TopupRequestDto> {
    return this.topups.create(user, dto);
  }

  @Get('mine')
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTopupsQueryDto,
  ): Promise<PaginatedTopupsDto> {
    return this.topups.listMine(user, query);
  }
}
