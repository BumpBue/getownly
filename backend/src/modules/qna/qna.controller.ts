import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import {
  CreateQnaReplyDto,
  CreateQnaThreadDto,
  ListQnaQueryDto,
  ResolveQnaThreadDto,
} from './dto/qna-request.dto';
import type {
  PaginatedInstructorQnaDto,
  PaginatedQnaThreadsDto,
  QnaThreadDto,
} from './dto/qna-response.dto';
import { QnaService } from './qna.service';

/**
 * The course Q&A board.
 *
 * Three roots, spelled out rather than sharing a prefix: `/courses/:id/qna` is
 * the board of one course, `/qna/:threadId` is one conversation once it exists,
 * and `/instructor/qna/pending` is a queue that belongs to a person rather than
 * to any one course.
 *
 * No `@Roles` on the board routes: what decides them is not which role you hold
 * but whether you paid for *this* course, which only the service can know.
 */
@Controller()
export class QnaController {
  constructor(private readonly qna: QnaService) {}

  @Get('courses/:id/qna')
  list(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListQnaQueryDto,
  ): Promise<PaginatedQnaThreadsDto> {
    return this.qna.listForCourse(courseId, user, query);
  }

  @Post('courses/:id/qna')
  ask(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQnaThreadDto,
  ): Promise<QnaThreadDto> {
    return this.qna.createThread(courseId, user, dto);
  }

  /**
   * The instructor's own queue. Declared before `/qna/:threadId` would ever be
   * consulted anyway — different root — but it is also the only route here that
   * is about a role rather than a course, so it carries one.
   */
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Get('instructor/qna/pending')
  pending(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListQnaQueryDto,
  ): Promise<PaginatedInstructorQnaDto> {
    return this.qna.listPendingForInstructor(user, query);
  }

  @Get('qna/:threadId')
  thread(
    @Param('threadId') threadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QnaThreadDto> {
    return this.qna.getThread(threadId, user);
  }

  @Post('qna/:threadId/replies')
  reply(
    @Param('threadId') threadId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQnaReplyDto,
  ): Promise<QnaThreadDto> {
    return this.qna.createReply(threadId, user, dto);
  }

  @Patch('qna/:threadId/resolve')
  resolve(
    @Param('threadId') threadId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResolveQnaThreadDto,
  ): Promise<QnaThreadDto> {
    return this.qna.setResolved(threadId, user, dto);
  }

  @Delete('qna/:threadId')
  remove(
    @Param('threadId') threadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ message: string }> {
    return this.qna.remove(threadId, user);
  }
}
