import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COURSE_MAX_PRICE_BAHT, QUIZ_PASS_SCORE_MAX, QUIZ_PASS_SCORE_MIN } from '@getownly/shared';
import { PrismaService } from '@/infra/prisma.service';
import {
  createCategory,
  createCourse,
  createLesson,
  createQuiz,
  createUser,
  resetDatabase,
} from './factories';

/**
 * ทก.01 A4 and A7, enforced by the database rather than only by a DTO.
 *
 * Every write below goes in as raw SQL on purpose. Going through Prisma would
 * prove the application refuses bad values, which the DTO tests already cover;
 * what this file proves is that the value cannot land even when nothing in
 * TypeScript is looking — a seed script, a console session, a future endpoint
 * that forgets its DTO.
 */
describe('scope CHECK constraints', () => {
  let prisma: PrismaService;
  let courseId: string;
  let quizId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);

    const instructor = await createUser(prisma, { role: 'INSTRUCTOR' });
    const categoryId = await createCategory(prisma);
    courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '500.00',
    });
    quizId = await createQuiz(prisma, {
      lessonId: await createLesson(prisma, { courseId, orderIndex: 1 }),
      questions: 2,
      passScore: 70,
    });
  });

  /** Postgres reports a failed CHECK as SQLSTATE 23514. */
  async function refused(run: () => Promise<unknown>): Promise<string> {
    const error = await run().then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).not.toBeNull();
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain('23514');
    return message;
  }

  describe('Course.price', () => {
    it(`refuses a price above ${COURSE_MAX_PRICE_BAHT} written straight to the table`, async () => {
      const message = await refused(
        () => prisma.$executeRaw`UPDATE "Course" SET price = 10000.01 WHERE id = ${courseId}`,
      );
      expect(message).toContain('Course_price_within_scope');

      const untouched = await prisma.course.findUniqueOrThrow({
        where: { id: courseId },
        select: { price: true },
      });
      expect(untouched.price.toFixed(2)).toBe('500.00');
    });

    it('refuses a negative price', async () => {
      await refused(
        () => prisma.$executeRaw`UPDATE "Course" SET price = -1 WHERE id = ${courseId}`,
      );
    });

    it('accepts both ends of the allowed range', async () => {
      for (const price of ['0.00', String(COURSE_MAX_PRICE_BAHT)]) {
        await prisma.$executeRawUnsafe(
          `UPDATE "Course" SET price = ${price} WHERE id = '${courseId}'`,
        );
      }

      const stored = await prisma.course.findUniqueOrThrow({
        where: { id: courseId },
        select: { price: true },
      });
      expect(stored.price.toFixed(2)).toBe('10000.00');
    });

    it('refuses an INSERT that skips the application entirely', async () => {
      const instructor = await prisma.course.findUniqueOrThrow({
        where: { id: courseId },
        select: { instructorId: true, categoryId: true },
      });

      await refused(
        () => prisma.$executeRaw`
          INSERT INTO "Course" (id, "instructorId", "categoryId", title, description, price, status, "updatedAt")
          VALUES ('cktoodear0000000000000000', ${instructor.instructorId}, ${instructor.categoryId},
                  'คอร์สแพงเกินเพดาน', 'ทดสอบ CHECK constraint', 99999.00, 'DRAFT', NOW())
        `,
      );
    });
  });

  describe('Quiz.passScore', () => {
    it(`refuses ${QUIZ_PASS_SCORE_MIN - 1}, the value the previous scope allowed`, async () => {
      const message = await refused(
        () => prisma.$executeRaw`UPDATE "Quiz" SET "passScore" = 59 WHERE id = ${quizId}`,
      );
      expect(message).toContain('Quiz_passScore_within_scope');

      const untouched = await prisma.quiz.findUniqueOrThrow({
        where: { id: quizId },
        select: { passScore: true },
      });
      expect(untouched.passScore).toBe(70);
    });

    it(`refuses ${QUIZ_PASS_SCORE_MAX + 1}`, async () => {
      await refused(
        () => prisma.$executeRaw`UPDATE "Quiz" SET "passScore" = 101 WHERE id = ${quizId}`,
      );
    });

    it('accepts both ends of the allowed range', async () => {
      for (const passScore of [QUIZ_PASS_SCORE_MIN, QUIZ_PASS_SCORE_MAX]) {
        await prisma.$executeRawUnsafe(
          `UPDATE "Quiz" SET "passScore" = ${passScore} WHERE id = '${quizId}'`,
        );
      }

      const stored = await prisma.quiz.findUniqueOrThrow({
        where: { id: quizId },
        select: { passScore: true },
      });
      expect(stored.passScore).toBe(QUIZ_PASS_SCORE_MAX);
    });
  });

  describe('QuizAttempt.passScoreSnapshot', () => {
    it('is deliberately unconstrained, because it records history', async () => {
      const student = await createUser(prisma, { role: 'STUDENT' });

      // A bar of 50 is outside what an instructor may set today. An attempt
      // judged under an older rule still has to be storable, or revising the
      // allowed range would mean rewriting results that already happened.
      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId,
          studentId: student.id,
          score: 55,
          passed: true,
          passScoreSnapshot: 50,
        },
        select: { id: true, passScoreSnapshot: true },
      });

      expect(attempt.passScoreSnapshot).toBe(50);
    });
  });
});
