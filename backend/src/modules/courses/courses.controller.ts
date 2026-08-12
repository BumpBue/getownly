import {
  Body,
  Controller,
  Delete,
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
import { OptionalUser } from '@/common/decorators/optional-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CoursesService } from './courses.service';
import { CreateCourseDto, ListCoursesQueryDto, UpdateCourseDto } from './dto/course-request.dto';
import type {
  CourseDetailDto,
  InstructorCourseDto,
  InstructorStatsDto,
  PaginatedCoursesDto,
} from './dto/course-response.dto';

/**
 * Route order matters: `/courses/mine` is declared before `/courses/:id`,
 * or "mine" would be read as a course id.
 *
 * No handler here touches Prisma, and none of them trusts a body field for
 * identity or price — both are CLAUDE.md rules, not preferences.
 */
@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Public()
  @Get()
  list(@Query() query: ListCoursesQueryDto): Promise<PaginatedCoursesDto> {
    return this.courses.listPublished(query);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<InstructorCourseDto[]> {
    return this.courses.listMine(user);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Get('mine/stats')
  myStats(@CurrentUser() user: AuthenticatedUser): Promise<InstructorStatsDto> {
    return this.courses.statsFor(user);
  }

  /** Public, but a signed-in viewer is recognised so owners can see drafts. */
  @Public()
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<CourseDetailDto> {
    return this.courses.findOne(id, viewer);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCourseDto,
  ): Promise<CourseDetailDto> {
    return this.courses.create(user, dto);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCourseDto,
  ): Promise<CourseDetailDto> {
    return this.courses.update(id, user, dto);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ message: string }> {
    return this.courses.remove(id, user);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Post(':id/submit')
  submit(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CourseDetailDto> {
    return this.courses.submitForReview(id, user);
  }

  /** Takes a published course off the market without deleting it. */
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Post(':id/unpublish')
  unpublish(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CourseDetailDto> {
    return this.courses.unpublish(id, user);
  }
}
