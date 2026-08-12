import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import type { LearnLessonDto, LearnRoomDto, ProgressResultDto } from './dto/learn-response.dto';
import { UpdateProgressDto } from './dto/progress-request.dto';
import { LearnService } from './learn.service';

/**
 * The classroom.
 *
 * Two roots, spelled out rather than sharing a prefix: `/learn/...` is the
 * course as a place you sit in, `/progress/...` is a fact about one lesson that
 * the player reports while it plays. An empty `@Controller()` keeps both
 * readable, the same way EnrollmentsController does.
 *
 * ADMIN is excluded because there is nothing here an admin can do: every route
 * needs an Enrollment row, and admins do not buy courses.
 */
@Roles(Role.STUDENT, Role.INSTRUCTOR)
@Controller()
export class LearnController {
  constructor(private readonly learn: LearnService) {}

  @Get('learn/:courseId')
  room(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LearnRoomDto> {
    return this.learn.getRoom(courseId, user.id);
  }

  @Get('learn/:courseId/lessons/:lessonId')
  lesson(
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LearnLessonDto> {
    return this.learn.getLesson(courseId, lessonId, user.id);
  }

  /** Fired every ten seconds by the player. Position only, never completion. */
  @Patch('progress/:lessonId')
  saveProgress(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProgressDto,
  ): Promise<ProgressResultDto> {
    return this.learn.savePosition(lessonId, user.id, dto.lastPositionSec);
  }

  /** 200, not 201: finishing a lesson twice creates nothing the second time. */
  @HttpCode(HttpStatus.OK)
  @Post('progress/:lessonId/complete')
  complete(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProgressResultDto> {
    return this.learn.complete(lessonId, user.id);
  }
}
