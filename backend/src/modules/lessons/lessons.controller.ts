import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CreateLessonDto, ReorderLessonsDto, UpdateLessonDto } from './dto/lesson-request.dto';
import type { LessonDto } from './dto/lesson-response.dto';
import { LessonsService } from './lessons.service';

/**
 * Lessons are addressed two ways: through their course when the course is what
 * identifies them (create, list, reorder), and directly by id once they exist.
 */
@Controller()
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Get('courses/:courseId/lessons')
  list(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LessonDto[]> {
    return this.lessons.listForCourse(courseId, user);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Post('courses/:courseId/lessons')
  create(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLessonDto,
  ): Promise<LessonDto> {
    return this.lessons.create(courseId, user, dto);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Patch('courses/:courseId/lessons/reorder')
  reorder(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderLessonsDto,
  ): Promise<LessonDto[]> {
    return this.lessons.reorder(courseId, user, dto);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Patch('lessons/:id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLessonDto,
  ): Promise<LessonDto> {
    return this.lessons.update(id, user, dto);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Delete('lessons/:id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ message: string }> {
    return this.lessons.remove(id, user);
  }

  /**
   * Proxies the video through the API instead of redirecting to storage.
   *
   * `@Res()` is used without `passthrough` because the body is a pipe, not a
   * value: the bytes go straight from MinIO to the socket and are never held
   * in memory (PLAN.md, R6). Authentication and enrolment are re-checked in
   * the service on every single request, including every seek.
   */
  @Get('lessons/:id/stream')
  async stream(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const slice = await this.lessons.openVideo(id, user, range);

    response.status(slice.isPartial ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK);
    response.setHeader('Content-Type', slice.mimeType);
    response.setHeader('Content-Length', slice.end - slice.start + 1);
    // Without this the player has no way to know seeking is possible.
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Cache-Control', 'private, no-store');

    if (slice.isPartial) {
      response.setHeader('Content-Range', `bytes ${slice.start}-${slice.end}/${slice.totalBytes}`);
    }

    // If the viewer navigates away mid-download, stop pulling from storage.
    response.on('close', () => slice.stream.destroy());
    slice.stream.on('error', () => response.destroy());
    slice.stream.pipe(response);
  }
}
