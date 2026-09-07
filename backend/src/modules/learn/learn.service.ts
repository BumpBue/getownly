import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CourseNotFoundException } from '@/common/exceptions/catalog.exceptions';
import { courseProgressPercent } from '@/common/progress';
import { summariseAttempts, type QuizStanding as Standing } from '@/common/quiz-scoring';
import { LessonNotInCourseException } from '@/common/exceptions/learning.exceptions';
import { PrismaService } from '@/infra/prisma.service';
import { StorageService } from '@/infra/storage/storage.service';
import { CourseAccessService } from '@/modules/courses/course-access.service';
import type {
  CourseProgressDto,
  LearnLessonDto,
  LearnLessonSummaryDto,
  LearnRoomDto,
  LessonProgressDto,
  LessonQuizSummaryDto,
  ProgressResultDto,
} from './dto/learn-response.dto';

/** Everything the classroom needs about one lesson, in a single trip. */
const classroomLessonSelect = {
  id: true,
  title: true,
  orderIndex: true,
  durationSec: true,
  videoKey: true,
  _count: { select: { materials: true } },
  quiz: {
    select: {
      id: true,
      title: true,
      passScore: true,
      _count: { select: { questions: true } },
    },
  },
} satisfies Prisma.LessonSelect;

type ClassroomLesson = Prisma.LessonGetPayload<{ select: typeof classroomLessonSelect }>;

/** This student's standing on each quiz in the course, keyed by quiz id. */
type QuizStanding = Map<string, Standing>;

/** Resume position and completion, per lesson, for the student asking. */
type ProgressByLesson = Map<string, { lastPositionSec: number; completedAt: Date | null }>;

/**
 * The classroom: what a student sees once they have bought the course.
 *
 * Access is decided one way only — an Enrollment row must exist. The instructor
 * who wrote the course does not get in here without buying it, which is
 * deliberate: progress and quiz attempts hang off that row, so there would be
 * nowhere to put theirs.
 */
@Injectable()
export class LearnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly access: CourseAccessService,
  ) {}

  /** The course as a classroom: the lesson list, plus how far through it we are. */
  async getRoom(courseId: string, studentId: string): Promise<LearnRoomDto> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        coverKey: true,
        instructor: { select: { displayName: true } },
        lessons: { select: classroomLessonSelect, orderBy: { orderIndex: 'asc' } },
      },
    });

    if (!course) {
      throw new CourseNotFoundException();
    }

    const enrollment = await this.access.assertEnrolled(courseId, studentId);
    const [progress, standings] = await Promise.all([
      this.readProgress(enrollment.id),
      this.readQuizStandings(course.lessons, studentId),
    ]);

    const lessons = course.lessons.map((lesson) => toLessonSummary(lesson, progress, standings));

    return {
      courseId: course.id,
      courseTitle: course.title,
      instructorName: course.instructor.displayName,
      coverUrl: await this.storage.presignGetOrNull(course.coverKey),
      totalDurationSec: course.lessons.reduce(
        (total, lesson) => total + (lesson.durationSec ?? 0),
        0,
      ),
      enrolledAt: enrollment.enrolledAt.toISOString(),
      // Where the "continue" button goes: the first thing still unfinished,
      // falling back to the beginning once everything is done.
      resumeLessonId: lessons.find((lesson) => !lesson.isCompleted)?.id ?? lessons[0]?.id ?? null,
      ...summarise(lessons),
      lessons,
    };
  }

  /** One lesson's content: the video route, its attachments and its quiz. */
  async getLesson(courseId: string, lessonId: string, studentId: string): Promise<LearnLessonDto> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        lessons: { select: { id: true }, orderBy: { orderIndex: 'asc' } },
      },
    });

    if (!course) {
      throw new CourseNotFoundException();
    }

    const enrollment = await this.access.assertEnrolled(courseId, studentId);

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        ...classroomLessonSelect,
        courseId: true,
        materials: {
          select: { id: true, fileName: true, fileKey: true, fileSize: true, mimeType: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // A lesson id from another course must not resolve here, or the ordering
    // and the progress row would belong to two different courses.
    if (!lesson || lesson.courseId !== courseId) {
      throw new LessonNotInCourseException();
    }

    const [progress, standings] = await Promise.all([
      this.readProgress(enrollment.id),
      this.readQuizStandings([lesson], studentId),
    ]);

    const position = course.lessons.findIndex((item) => item.id === lessonId);

    return {
      id: lesson.id,
      courseId: course.id,
      courseTitle: course.title,
      title: lesson.title,
      orderIndex: lesson.orderIndex,
      durationSec: lesson.durationSec,
      // The proxy route, never a signed URL: every seek is re-authorised
      // (CLAUDE.md, ข้อห้าม 10).
      videoStreamUrl: lesson.videoKey ? `/lessons/${lesson.id}/stream` : null,
      materials: await Promise.all(
        lesson.materials.map(async (material) => ({
          id: material.id,
          fileName: material.fileName,
          fileSize: material.fileSize,
          mimeType: material.mimeType,
          downloadUrl: await this.storage.presignGetOrNull(material.fileKey),
        })),
      ),
      quiz: toQuizSummary(lesson.quiz, standings),
      progress: toProgressDto(lesson.id, progress),
      prevLessonId: position > 0 ? (course.lessons[position - 1]?.id ?? null) : null,
      nextLessonId: course.lessons[position + 1]?.id ?? null,
    };
  }

  /**
   * Records where the player is.
   *
   * Called every ten seconds while a video plays, so it never touches
   * `completedAt`: leaving a lesson halfway is not progress, and rewinding a
   * finished lesson must not un-finish it.
   */
  async savePosition(
    lessonId: string,
    studentId: string,
    lastPositionSec: number,
  ): Promise<ProgressResultDto> {
    const { enrollmentId, courseId } = await this.resolveLesson(lessonId, studentId);

    await this.prisma.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
      create: { enrollmentId, lessonId, lastPositionSec },
      update: { lastPositionSec },
    });

    return this.buildProgressResult(enrollmentId, courseId, lessonId);
  }

  /**
   * Marks a lesson finished.
   *
   * Idempotent: a second call keeps the first `completedAt`, so re-watching
   * does not rewrite when the student actually finished it.
   */
  async complete(lessonId: string, studentId: string): Promise<ProgressResultDto> {
    const { enrollmentId, courseId } = await this.resolveLesson(lessonId, studentId);
    const now = new Date();

    const existing = await this.prisma.lessonProgress.findUnique({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
      select: { completedAt: true },
    });

    await this.prisma.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
      create: { enrollmentId, lessonId, completedAt: now },
      update: { completedAt: existing?.completedAt ?? now },
    });

    return this.buildProgressResult(enrollmentId, courseId, lessonId);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** Finds the lesson's course and proves the caller is enrolled in it. */
  private async resolveLesson(
    lessonId: string,
    studentId: string,
  ): Promise<{ enrollmentId: string; courseId: string }> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { courseId: true },
    });

    if (!lesson) {
      throw new LessonNotInCourseException();
    }

    const enrollment = await this.access.assertEnrolled(lesson.courseId, studentId);
    return { enrollmentId: enrollment.id, courseId: lesson.courseId };
  }

  private async buildProgressResult(
    enrollmentId: string,
    courseId: string,
    lessonId: string,
  ): Promise<ProgressResultDto> {
    const [progress, lessonCount] = await Promise.all([
      this.readProgress(enrollmentId),
      this.prisma.lesson.count({ where: { courseId } }),
    ]);

    let completedLessonCount = 0;
    for (const entry of progress.values()) {
      if (entry.completedAt !== null) {
        completedLessonCount += 1;
      }
    }

    return {
      progress: toProgressDto(lessonId, progress),
      course: {
        lessonCount,
        completedLessonCount,
        progressPercent: courseProgressPercent(completedLessonCount, lessonCount),
      },
    };
  }

  private async readProgress(enrollmentId: string): Promise<ProgressByLesson> {
    const rows = await this.prisma.lessonProgress.findMany({
      where: { enrollmentId },
      select: { lessonId: true, lastPositionSec: true, completedAt: true },
    });

    return new Map(
      rows.map((row) => [
        row.lessonId,
        { lastPositionSec: row.lastPositionSec, completedAt: row.completedAt },
      ]),
    );
  }

  /**
   * Best score and attempt count per quiz.
   *
   * Grouped in one query rather than per lesson, so a course with twenty
   * quizzes still costs one round trip.
   */
  private async readQuizStandings(
    lessons: { quiz: { id: string } | null }[],
    studentId: string,
  ): Promise<QuizStanding> {
    const quizIds = lessons
      .map((lesson) => lesson.quiz?.id)
      .filter((id): id is string => id !== undefined);

    if (quizIds.length === 0) {
      return new Map();
    }

    // One query for the whole course, then grouped here — a verdict depends
    // on each attempt's own pass mark, which no SQL aggregate can express.
    const rows = await this.prisma.quizAttempt.findMany({
      where: { quizId: { in: quizIds }, studentId },
      select: { quizId: true, score: true, passScoreSnapshot: true },
    });

    const byQuiz = new Map<string, { score: number; passScoreSnapshot: number }[]>();
    for (const row of rows) {
      const bucket = byQuiz.get(row.quizId) ?? [];
      bucket.push(row);
      byQuiz.set(row.quizId, bucket);
    }

    return new Map(
      [...byQuiz.entries()].map(([quizId, attempts]) => [quizId, summariseAttempts(attempts)]),
    );
  }
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function toLessonSummary(
  lesson: ClassroomLesson,
  progress: ProgressByLesson,
  standings: QuizStanding,
): LearnLessonSummaryDto {
  const entry = progress.get(lesson.id);

  return {
    id: lesson.id,
    title: lesson.title,
    orderIndex: lesson.orderIndex,
    durationSec: lesson.durationSec,
    hasVideo: lesson.videoKey !== null,
    materialCount: lesson._count.materials,
    isCompleted: entry?.completedAt != null,
    lastPositionSec: entry?.lastPositionSec ?? 0,
    quiz: toQuizSummary(lesson.quiz, standings),
  };
}

function toQuizSummary(
  quiz: ClassroomLesson['quiz'],
  standings: QuizStanding,
): LessonQuizSummaryDto | null {
  if (!quiz) {
    return null;
  }

  const standing = standings.get(quiz.id);

  return {
    id: quiz.id,
    title: quiz.title,
    // The bar for a *new* attempt. Past verdicts came from each attempt's own
    // snapshot and are not recomputed against this number.
    passScore: quiz.passScore,
    questionCount: quiz._count.questions,
    bestScore: standing?.bestScore ?? null,
    hasPassed: standing?.hasPassed ?? false,
    attemptCount: standing?.attemptCount ?? 0,
  };
}

function toProgressDto(lessonId: string, progress: ProgressByLesson): LessonProgressDto {
  const entry = progress.get(lessonId);

  return {
    lessonId,
    lastPositionSec: entry?.lastPositionSec ?? 0,
    isCompleted: entry?.completedAt != null,
    completedAt: entry?.completedAt?.toISOString() ?? null,
  };
}

function summarise(lessons: LearnLessonSummaryDto[]): CourseProgressDto {
  const completedLessonCount = lessons.filter((lesson) => lesson.isCompleted).length;

  return {
    lessonCount: lessons.length,
    completedLessonCount,
    progressPercent: courseProgressPercent(completedLessonCount, lessons.length),
  };
}
