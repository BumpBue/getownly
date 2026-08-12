import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { LessonNotInCourseException } from '@/common/exceptions/learning.exceptions';
import {
  NotQnaThreadOwnerException,
  QnaAskRequiresEnrollmentException,
  QnaReplyNotAllowedException,
  QnaThreadNotFoundException,
} from '@/common/exceptions/qna.exceptions';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PrismaService } from '@/infra/prisma.service';
import { CourseAccessService, type QnaAccess } from '@/modules/courses/course-access.service';
import type {
  CreateQnaReplyDto,
  CreateQnaThreadDto,
  ListQnaQueryDto,
  ResolveQnaThreadDto,
} from './dto/qna-request.dto';
import type {
  PaginatedInstructorQnaDto,
  PaginatedQnaThreadsDto,
  QnaThreadDto,
  QnaThreadSummaryDto,
} from './dto/qna-response.dto';

const DEFAULT_PAGE_SIZE = 20;

/** Enough to render a board row without loading every reply of every thread. */
const summarySelect = {
  id: true,
  courseId: true,
  title: true,
  body: true,
  isResolved: true,
  createdAt: true,
  student: { select: { id: true, displayName: true } },
  lesson: { select: { id: true, title: true } },
  _count: { select: { replies: true } },
  replies: {
    select: { userId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.QnaThreadSelect;

type ThreadSummaryRow = Prisma.QnaThreadGetPayload<{ select: typeof summarySelect }>;

/**
 * The course Q&A board.
 *
 * One rule runs through every method: the board belongs to the course, and the
 * course decides who may see it. That decision is made once, in
 * {@link CourseAccessService.resolveQnaAccess}, and everything here reads the
 * answer off the object it returns rather than asking again in its own way.
 */
@Injectable()
export class QnaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
  ) {}

  /** The board for one course, filtered and paged. */
  async listForCourse(
    courseId: string,
    user: AuthenticatedUser,
    query: ListQnaQueryDto,
  ): Promise<PaginatedQnaThreadsDto> {
    const access = await this.access.resolveQnaAccess(courseId, user);

    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.QnaThreadWhereInput = { courseId };

    if (query.filter === 'answered') {
      where.replies = { some: { userId: access.instructorId } };
    } else if (query.filter === 'unanswered') {
      // "Unanswered" means the instructor has not replied — not that nobody
      // has. A classmate's guess is not the answer the badge promises.
      where.replies = { none: { userId: access.instructorId } };
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { body: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, unansweredTotal, rows] = await Promise.all([
      this.prisma.qnaThread.count({ where }),
      this.prisma.qnaThread.count({
        where: { courseId, replies: { none: { userId: access.instructorId } } },
      }),
      this.prisma.qnaThread.findMany({
        where,
        select: summarySelect,
        // `id` breaks ties so two questions asked in the same millisecond
        // cannot swap pages between reads, as GET /wallet does.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => toSummary(row, access.instructorId)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      unansweredTotal,
      canAsk: access.canAsk,
      canReply: access.canReply,
    };
  }

  /** One thread with every reply, oldest first, as a conversation reads. */
  async getThread(threadId: string, user: AuthenticatedUser): Promise<QnaThreadDto> {
    const thread = await this.loadThread(threadId);
    const access = await this.access.resolveQnaAccess(thread.courseId, user);

    return this.toDetail(threadId, access, user);
  }

  async createThread(
    courseId: string,
    user: AuthenticatedUser,
    dto: CreateQnaThreadDto,
  ): Promise<QnaThreadDto> {
    const access = await this.access.resolveQnaAccess(courseId, user);

    if (!access.canAsk) {
      throw new QnaAskRequiresEnrollmentException();
    }

    if (dto.lessonId) {
      // A lesson id from another course would put the question on a board it
      // does not belong to.
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: dto.lessonId },
        select: { courseId: true },
      });
      if (!lesson || lesson.courseId !== courseId) {
        throw new LessonNotInCourseException();
      }
    }

    const thread = await this.prisma.qnaThread.create({
      data: {
        courseId,
        studentId: user.id,
        lessonId: dto.lessonId ?? null,
        title: dto.title.trim(),
        body: dto.body.trim(),
      },
      select: { id: true },
    });

    return this.toDetail(thread.id, access, user);
  }

  /**
   * Adds a reply and hands back the whole thread.
   *
   * Returning the thread rather than the reply saves the screen a second round
   * trip, and means the answer badge on it is never a guess the client made.
   */
  async createReply(
    threadId: string,
    user: AuthenticatedUser,
    dto: CreateQnaReplyDto,
  ): Promise<QnaThreadDto> {
    const thread = await this.loadThread(threadId);
    const access = await this.access.resolveQnaAccess(thread.courseId, user);

    // Admins read and moderate this board; they do not take part in it.
    if (!access.canReply) {
      throw new QnaReplyNotAllowedException();
    }

    await this.prisma.qnaReply.create({
      data: { threadId, userId: user.id, body: dto.body.trim() },
    });

    return this.toDetail(threadId, access, user);
  }

  /** Closes a thread, or reopens one closed by mistake. */
  async setResolved(
    threadId: string,
    user: AuthenticatedUser,
    dto: ResolveQnaThreadDto,
  ): Promise<QnaThreadDto> {
    const thread = await this.loadThread(threadId);
    const access = await this.access.resolveQnaAccess(thread.courseId, user);

    if (thread.studentId !== user.id && !access.isInstructor) {
      throw new NotQnaThreadOwnerException('RESOLVE');
    }

    await this.prisma.qnaThread.update({
      where: { id: threadId },
      data: { isResolved: dto.isResolved ?? true },
    });

    return this.toDetail(threadId, access, user);
  }

  async remove(threadId: string, user: AuthenticatedUser): Promise<{ message: string }> {
    const thread = await this.loadThread(threadId);
    const access = await this.access.resolveQnaAccess(thread.courseId, user);

    if (thread.studentId !== user.id && !access.isInstructor && user.role !== Role.ADMIN) {
      throw new NotQnaThreadOwnerException('DELETE');
    }

    // Replies cascade with the thread, so the conversation goes as one piece.
    await this.prisma.qnaThread.delete({ where: { id: threadId } });

    return { message: 'ลบกระทู้เรียบร้อยแล้ว' };
  }

  /**
   * The instructor's inbox: questions still waiting on them, across every
   * course they own.
   *
   * "Waiting" is decided by their own absence from the replies, not by the
   * reply count — a thread three students have guessed at is still unanswered.
   * Threads the asker has closed are left out: nobody is waiting on those.
   */
  async listPendingForInstructor(
    user: AuthenticatedUser,
    query: ListQnaQueryDto,
  ): Promise<PaginatedInstructorQnaDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.QnaThreadWhereInput = {
      course: { instructorId: user.id },
      isResolved: false,
      replies: { none: { userId: user.id } },
    };

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { body: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.qnaThread.count({ where }),
      this.prisma.qnaThread.findMany({
        where,
        select: { ...summarySelect, course: { select: { id: true, title: true } } },
        // Oldest first: the question that has waited longest is the one to answer.
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => ({
        // Every row here belongs to a course this instructor owns, so they are
        // the instructor whose absence makes it pending.
        ...toSummary(row, user.id),
        course: row.course,
      })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async loadThread(
    threadId: string,
  ): Promise<{ id: string; courseId: string; studentId: string }> {
    const thread = await this.prisma.qnaThread.findUnique({
      where: { id: threadId },
      select: { id: true, courseId: true, studentId: true },
    });

    if (!thread) {
      throw new QnaThreadNotFoundException();
    }

    return thread;
  }

  private async toDetail(
    threadId: string,
    access: QnaAccess,
    user: AuthenticatedUser,
  ): Promise<QnaThreadDto> {
    const thread = await this.prisma.qnaThread.findUniqueOrThrow({
      where: { id: threadId },
      select: {
        ...summarySelect,
        replies: {
          select: {
            id: true,
            body: true,
            createdAt: true,
            userId: true,
            user: { select: { id: true, displayName: true } },
          },
          // Oldest first: a conversation is read from the top.
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });

    const isThreadOwner = thread.student.id === user.id;

    return {
      ...toSummary(thread, access.instructorId),
      courseTitle: access.courseTitle,
      replies: thread.replies.map((reply) => ({
        id: reply.id,
        author: reply.user,
        isInstructorReply: reply.userId === access.instructorId,
        body: reply.body,
        createdAt: reply.createdAt.toISOString(),
      })),
      canReply: access.canReply,
      canResolve: isThreadOwner || access.isInstructor,
      canDelete: isThreadOwner || access.isInstructor || access.isAdmin,
    };
  }
}

/**
 * The parts of a thread every screen shows, plus the one derived fact the
 * badges are built on: has the instructor been here yet.
 */
function toSummary(
  thread: Pick<
    ThreadSummaryRow,
    | 'id'
    | 'courseId'
    | 'title'
    | 'body'
    | 'isResolved'
    | 'createdAt'
    | 'student'
    | 'lesson'
    | '_count'
  > & { replies: { userId: string; createdAt: Date }[] },
  instructorId: string,
): QnaThreadSummaryDto {
  const lastReplyAt = thread.replies.reduce<Date | null>(
    (latest, reply) => (latest === null || reply.createdAt > latest ? reply.createdAt : latest),
    null,
  );

  return {
    id: thread.id,
    courseId: thread.courseId,
    title: thread.title,
    body: thread.body,
    author: thread.student,
    lesson: thread.lesson,
    isResolved: thread.isResolved,
    replyCount: thread._count.replies,
    hasInstructorReply: thread.replies.some((reply) => reply.userId === instructorId),
    lastReplyAt: lastReplyAt?.toISOString() ?? null,
    createdAt: thread.createdAt.toISOString(),
  };
}
