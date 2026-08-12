import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { ReportRangeQueryDto } from './dto/report-request.dto';
import type {
  AdminOverviewDto,
  DailySalesDto,
  InstructorOverviewDto,
  TopCourseDto,
  TopInstructorDto,
  TrialBalanceDto,
} from './dto/report-response.dto';
import { ReportsService } from './reports.service';

/**
 * Platform-wide reporting. Every figure is a sum of ledger entries, so these
 * screens and the accounts can never tell two different stories.
 */
@Roles(Role.ADMIN)
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  overview(@Query() query: ReportRangeQueryDto): Promise<AdminOverviewDto> {
    return this.reports.adminOverview(query);
  }

  @Get('sales-daily')
  salesDaily(@Query() query: ReportRangeQueryDto): Promise<DailySalesDto> {
    return this.reports.dailySales(query);
  }

  @Get('top-courses')
  topCourses(@Query() query: ReportRangeQueryDto): Promise<TopCourseDto[]> {
    return this.reports.topCourses(query);
  }

  @Get('top-instructors')
  topInstructors(@Query() query: ReportRangeQueryDto): Promise<TopInstructorDto[]> {
    return this.reports.topInstructors(query);
  }

  /** งบทดลอง — proof that the double-entry ledger balances, all-time. */
  @Get('ledger')
  trialBalance(): Promise<TrialBalanceDto> {
    return this.reports.trialBalance();
  }
}

/**
 * The instructor's own numbers.
 *
 * The id comes from the token and is never accepted from the request, so there
 * is no shape of call that reports on somebody else's sales
 * (CLAUDE.md, ข้อห้าม 7).
 */
@Roles(Role.INSTRUCTOR, Role.ADMIN)
@Controller('instructor/reports')
export class InstructorReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser): Promise<InstructorOverviewDto> {
    return this.reports.instructorOverview(user.id);
  }
}
