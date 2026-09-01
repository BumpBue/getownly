import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { ContentReportsService } from './content-reports.service';
import {
  CreateContentReportDto,
  ListContentReportsQueryDto,
  ReviewContentReportDto,
} from './dto/content-report-request.dto';
import type {
  ContentReportDto,
  PaginatedContentReportsDto,
} from './dto/content-report-response.dto';

/**
 * `/content-reports` rather than `/reports`: that root already belongs to
 * AdminReportsController's sales and ledger reports, a completely different
 * feature this must not collide with.
 */
@Controller()
export class ContentReportsController {
  constructor(private readonly reports: ContentReportsService) {}

  /** No @Roles: any signed-in role may report a course or a Q&A thread. */
  @HttpCode(HttpStatus.OK)
  @Post('content-reports')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateContentReportDto,
  ): Promise<{ message: string }> {
    return this.reports.create(user, dto);
  }

  @Roles(Role.ADMIN)
  @Get('admin/content-reports')
  list(@Query() query: ListContentReportsQueryDto): Promise<PaginatedContentReportsDto> {
    return this.reports.listForAdmin(query);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/content-reports/:id/review')
  review(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ReviewContentReportDto,
  ): Promise<ContentReportDto> {
    return this.reports.review(id, admin, dto);
  }
}
