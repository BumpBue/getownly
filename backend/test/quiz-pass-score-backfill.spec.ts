import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/infra/prisma.service';
import {
  createCategory,
  createCourse,
  createLesson,
  createQuiz,
  createUser,
  enrol,
  resetDatabase,
} from './factories';

/**
 * (ฎ) The migration that added `QuizAttempt.passScoreSnapshot` backfilled it
 * from `Quiz.passScore`.
 *
 * That is exact rather than a guess, and this proves why: until this change a
 * quiz froze completely the moment anybody sat it, so its pass mark cannot
 * have moved since its first attempt was graded. The current value therefore
 * *is* the value every pre-existing attempt was judged against.
 *
 * The test recreates the pre-migration shape — a row whose snapshot is unknown
 * — by writing it and then blanking the column with raw SQL, runs the same
 * UPDATE the migration runs, and checks nothing about the verdict changed.
 */
describe('passScoreSnapshot backfill', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  /**
   * Replays the migration on rows that already exist: drop the NOT NULL, blank
   * the column to recreate the pre-migration shape, run the backfill exactly as
   * 20260908014500_add_quiz_attempt_pass_score_snapshot does, then put the
   * constraint back.
   *
   * The restore is in a `finally` so a failing assertion cannot leave the
   * column nullable for the rest of the suite, which shares this database.
   */
  async function replayMigration(): Promise<void> {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "QuizAttempt" ALTER COLUMN "passScoreSnapshot" DROP NOT NULL',
    );
    try {
      await prisma.$executeRaw`UPDATE "QuizAttempt" SET "passScoreSnapshot" = NULL`;
      await prisma.$executeRaw`
        UPDATE "QuizAttempt" a
        SET "passScoreSnapshot" = q."passScore"
        FROM "Quiz" q
        WHERE q.id = a."quizId"
      `;
    } finally {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "QuizAttempt" ALTER COLUMN "passScoreSnapshot" SET NOT NULL',
      );
    }
  }

  it('gives every legacy attempt the pass mark of its own quiz', async () => {
    const instructor = await createUser(prisma, { role: 'INSTRUCTOR' });
    const categoryId = await createCategory(prisma);
    const courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '0.00',
    });

    // Two quizzes on different pass marks, so a single global default would
    // not be able to fake a pass.
    const strictQuiz = await createQuiz(prisma, {
      lessonId: await createLesson(prisma, { courseId, orderIndex: 1 }),
      questions: 2,
      passScore: 90,
    });
    const gentleQuiz = await createQuiz(prisma, {
      lessonId: await createLesson(prisma, { courseId, orderIndex: 2 }),
      questions: 2,
      passScore: 60,
    });

    const student = await createUser(prisma, { role: 'STUDENT' });
    await enrol(prisma, { courseId, studentId: student.id });

    // 65 fails the strict quiz and passes the gentle one. Written the way the
    // pre-migration code did: a verdict, with no record of the bar.
    for (const [quizId, passed] of [
      [strictQuiz, false],
      [gentleQuiz, true],
    ] as const) {
      await prisma.quizAttempt.create({
        data: { quizId, studentId: student.id, score: 65, passed, passScoreSnapshot: 0 },
      });
    }
    const before = await prisma.quizAttempt.findMany({
      orderBy: { quizId: 'asc' },
      select: { quizId: true, score: true, passed: true },
    });

    await replayMigration();

    const after = await prisma.quizAttempt.findMany({
      orderBy: { quizId: 'asc' },
      select: { quizId: true, score: true, passed: true, passScoreSnapshot: true },
    });

    // Every row now carries its own quiz's mark...
    const marks = new Map(after.map((row) => [row.quizId, row.passScoreSnapshot]));
    expect(marks.get(strictQuiz)).toBe(90);
    expect(marks.get(gentleQuiz)).toBe(60);

    // ...and not one verdict moved.
    expect(after.map(({ quizId, score, passed }) => ({ quizId, score, passed }))).toEqual(before);

    // The restored NOT NULL also proves the migration's third step holds:
    // every row came out of the backfill with a mark.
    // The backfilled mark agrees with the verdict already stored, which is
    // the property that makes it safe to judge by from here on.
    for (const row of after) {
      expect(row.passed).toBe(row.score >= row.passScoreSnapshot);
    }
  });

  it('leaves no attempt without a mark once it has run', async () => {
    const instructor = await createUser(prisma, { role: 'INSTRUCTOR' });
    const categoryId = await createCategory(prisma);
    const courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '0.00',
    });
    const quizId = await createQuiz(prisma, {
      lessonId: await createLesson(prisma, { courseId, orderIndex: 1 }),
      questions: 2,
      passScore: 75,
    });

    const student = await createUser(prisma, { role: 'STUDENT' });
    await enrol(prisma, { courseId, studentId: student.id });
    await prisma.quizAttempt.create({
      data: { quizId, studentId: student.id, score: 80, passed: true, passScoreSnapshot: 0 },
    });
    await replayMigration();

    const missing = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM "QuizAttempt" WHERE "passScoreSnapshot" IS NULL
    `;
    expect(Number(missing[0].count)).toBe(0);
  });
});
