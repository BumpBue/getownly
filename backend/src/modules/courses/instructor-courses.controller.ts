import { Controller, Get, Param, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CourseAccessService } from './course-access.service';
import { CourseStudentsService } from './course-students.service';
import {
  ListCourseStudentsQueryDto,
  type PaginatedCourseStudentsDto,
} from './dto/course-students.dto';

/**
 * What an instructor reads about a course they own, as opposed to what they
 * edit on it.
 */
@Roles(Role.INSTRUCTOR, Role.ADMIN)
@Controller('instructor/courses')
export class InstructorCoursesController {
  constructor(
    private readonly access: CourseAccessService,
    private readonly students: CourseStudentsService,
  ) {}

  /**
   * ทก.01 A9: the roster, with progress and quiz scores.
   *
   * `assertCourseOwner` is the whole authorisation, and it runs before the
   * roster query is even built — `@Roles(INSTRUCTOR)` only proves the caller
   * is *an* instructor, never that this course is theirs.
   */
  @Get(':id/students')
  async listStudents(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCourseStudentsQueryDto,
  ): Promise<PaginatedCourseStudentsDto> {
    await this.access.assertCourseOwner(courseId, user);
    return this.students.listForCourse(courseId, query);
  }
}
