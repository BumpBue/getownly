import { Injectable } from '@nestjs/common';
import { courseProgressPercent } from '@/common/progress';
import { PrismaService } from '@/infra/prisma.service';
import type {
  CourseStudentDto,
  CourseStudentQuizDto,
  ListCourseStudentsQueryDto,
  PaginatedCourseStudentsDto,
} from './dto/course-students.dto';

const DEFAULT_PAGE_SIZE = 20;

/**
 * The roster of one course: who is enrolled, how far they have got, and how
 * they did on each quiz (ทก.01 A9).
 *
 * Separate from CoursesService for the same reason CourseReviewService is: it
 * serves a different question. CoursesService answers "what is in this course";
 * this answers "who is in it and how are they doing", which is read by exactly
 * one person — the instructor who owns it.
 *
 * Ownership is *not* checked here. The controller settles it through
 * CourseAccessService before calling in, and every query below is additionally
 * scoped by `courseId`, so there is nothing this class can reach that the
 * caller was not already entitled to.
 */
@Injectable()
export class CourseStudentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One page of the roster.
   *
   * Six queries, whatever the page size: the page of enrolments, its total,
   * the course's lesson count, the course's quizzes, completed-lesson counts
   * grouped per enrolment, and quiz standings grouped per (student, quiz).
   * The last two are the ones that would otherwise be a query per student, so
   * both are `groupBy` over the whole page at once.
   *
   * Free enrolments are included. The roster is about who is *learning*, not
   * about who paid — a free sign-up is as real a student as a buyer, and the
   * earnings table (A10) is where money is accounted for.
   *
   * A student whose account was later suspended stays on the list too: they
   * enrolled, the sale happened, and their progress is still part of how this
   * course is doing.
   */
  async listForCourse(
    courseId: string,
    query: ListCourseStudentsQueryDto,
  ): Promise<PaginatedCourseStudentsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const [enrollments, total, lessonCount, quizzes] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { courseId },
        // Newest enrolment first; id breaks ties so two sign-ups in the same
        // millisecond cannot swap places between pages.
        orderBy: [{ enrolledAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          enrolledAt: true,
          student: { select: { id: true, displayName: true } },
        },
      }),
      this.prisma.enrollment.count({ where: { courseId } }),
      this.prisma.lesson.count({ where: { courseId } }),
      this.prisma.quiz.findMany({
        where: { lesson: { courseId } },
        orderBy: { lesson: { orderIndex: 'asc' } },
        select: {
          id: true,
          title: true,
          passScore: true,
          lesson: { select: { id: true, title: true } },
        },
      }),
    ]);

    const enrollmentIds = enrollments.map((row) => row.id);
    const studentIds = enrollments.map((row) => row.student.id);
    const quizIds = quizzes.map((quiz) => quiz.id);

    const [completedRows, attemptRows] = await Promise.all([
      enrollmentIds.length === 0
        ? []
        : this.prisma.lessonProgress.groupBy({
            by: ['enrollmentId'],
            where: { enrollmentId: { in: enrollmentIds }, completedAt: { not: null } },
            _count: { _all: true },
          }),
      studentIds.length === 0 || quizIds.length === 0
        ? []
        : this.prisma.quizAttempt.groupBy({
            by: ['studentId', 'quizId'],
            where: { studentId: { in: studentIds }, quizId: { in: quizIds } },
            // Highest score, not latest: a quiz may be re-sat as often as the
            // student likes (Soft Lock), and the best attempt is the one that
            // decides whether they passed.
            _max: { score: true },
            _count: { _all: true },
          }),
    ]);

    const completedByEnrollment = new Map(
      completedRows.map((row) => [row.enrollmentId, row._count._all]),
    );
    const standingByStudentQuiz = new Map(
      attemptRows.map((row) => [
        `${row.studentId}:${row.quizId}`,
        { bestScore: row._max.score, attemptCount: row._count._all },
      ]),
    );

    const items = enrollments.map((enrollment): CourseStudentDto => {
      const completedLessonCount = completedByEnrollment.get(enrollment.id) ?? 0;

      const quizStandings = quizzes.map((quiz): CourseStudentQuizDto => {
        const standing = standingByStudentQuiz.get(`${enrollment.student.id}:${quiz.id}`);
        const bestScore = standing?.bestScore ?? null;

        return {
          quizId: quiz.id,
          lessonId: quiz.lesson.id,
          lessonTitle: quiz.lesson.title,
          quizTitle: quiz.title,
          passScore: quiz.passScore,
          bestScore,
          hasPassed: bestScore !== null && bestScore >= quiz.passScore,
          attemptCount: standing?.attemptCount ?? 0,
        };
      });

      return {
        enrollmentId: enrollment.id,
        studentId: enrollment.student.id,
        displayName: enrollment.student.displayName,
        enrolledAt: enrollment.enrolledAt.toISOString(),
        lessonCount,
        completedLessonCount,
        progressPercent: courseProgressPercent(completedLessonCount, lessonCount),
        passedQuizCount: quizStandings.filter((quiz) => quiz.hasPassed).length,
        quizCount: quizzes.length,
        quizzes: quizStandings,
      };
    });

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      lessonCount,
      quizCount: quizzes.length,
    };
  }
}
