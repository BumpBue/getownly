import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '@/common/decorators/roles.decorator';
import { CourseReviewService } from './course-review.service';
import { ListPendingCoursesQueryDto, RejectCourseDto } from './dto/course-request.dto';
import type { PaginatedPendingCoursesDto, PendingCourseDto } from './dto/course-response.dto';

/** The course approval queue. ADMIN only, like every other queue in the system. */
@Roles(Role.ADMIN)
@Controller('admin/courses')
export class AdminCoursesController {
  constructor(private readonly review: CourseReviewService) {}

  @Get('pending')
  listPending(@Query() query: ListPendingCoursesQueryDto): Promise<PaginatedPendingCoursesDto> {
    return this.review.listPending(query);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string): Promise<PendingCourseDto> {
    return this.review.approve(id);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectCourseDto): Promise<PendingCourseDto> {
    return this.review.reject(id, dto.reason);
  }
}
