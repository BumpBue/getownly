import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/infra/prisma.service';
import { CourseAccessService } from '@/modules/courses/course-access.service';
import { QuizzesService } from './quizzes.service';
import {
  asAuthUser,
  createCategory,
  createCourse,
  createLesson,
  createQuiz,
  createUser,
  enrol,
  resetDatabase,
  type TestUser,
} from '../../../test/factories';

/** Reads the paper back with its answer key, which only a test may do. */
async function readKey(
  prisma: PrismaService,
  quizId: string,
): Promise<{ questionId: string; correctChoiceId: string; wrongChoiceId: string }[]> {
  const questions = await prisma.quizQuestion.findMany({
    where: { quizId },
    orderBy: { orderIndex: 'asc' },
    select: {
      id: true,
      choices: { select: { id: true, isCorrect: true }, orderBy: { orderIndex: 'asc' } },
    },
  });

  return questions.map((question) => ({
    questionId: question.id,
    correctChoiceId: question.choices.find((choice) => choice.isCorrect)?.id as string,
    wrongChoiceId: question.choices.find((choice) => !choice.isCorrect)?.id as string,
  }));
}

describe('QuizzesService', () => {
  let prisma: PrismaService;
  let quizzes: QuizzesService;

  let instructor: TestUser;
  let student: TestUser;
  let courseId: string;
  let lessonId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    quizzes = new QuizzesService(prisma, new CourseAccessService(prisma));

    instructor = await createUser(prisma, { role: 'INSTRUCTOR' });
    student = await createUser(prisma, { role: 'STUDENT' });

    const categoryId = await createCategory(prisma);
    courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '1000.00',
    });
    lessonId = await createLesson(prisma, { courseId, orderIndex: 1 });
    await enrol(prisma, { courseId, studentId: student.id });
  });

  const quizInput = {
    title: 'แบบทดสอบท้ายบท',
    passScore: 70,
    questions: [
      {
        questionText: 'ข้อใดคือคำตอบที่ถูกต้อง',
        choices: [
          { choiceText: 'ถูกต้อง', isCorrect: true },
          { choiceText: 'ไม่ถูกต้อง', isCorrect: false },
        ],
      },
    ],
  };

  // --- authoring -----------------------------------------------------------

  it('creates a quiz with its questions numbered from one', async () => {
    const quiz = await quizzes.create(lessonId, asAuthUser(instructor), {
      title: 'แบบทดสอบสองข้อ',
      passScore: 50,
      questions: [
        {
          questionText: 'คำถามข้อแรกของแบบทดสอบ',
          choices: [
            { choiceText: 'ก', isCorrect: true },
            { choiceText: 'ข', isCorrect: false },
          ],
        },
        {
          questionText: 'คำถามข้อที่สองของแบบทดสอบ',
          choices: [
            { choiceText: 'ค', isCorrect: false },
            { choiceText: 'ง', isCorrect: true },
          ],
        },
      ],
    });

    expect(quiz.lessonId).toBe(lessonId);
    expect(quiz.courseId).toBe(courseId);
    expect(quiz.questionCount).toBe(2);
    expect(quiz.questions.map((question) => question.orderIndex)).toEqual([1, 2]);
    expect(quiz.questions[1]?.choices.map((choice) => choice.orderIndex)).toEqual([1, 2]);
  });

  it('refuses a second quiz on the same lesson', async () => {
    await quizzes.create(lessonId, asAuthUser(instructor), quizInput);

    await expect(quizzes.create(lessonId, asAuthUser(instructor), quizInput)).rejects.toMatchObject(
      { code: 'QUIZ_ALREADY_EXISTS' },
    );
  });

  it('refuses a question with no correct choice, or with two', async () => {
    await expect(
      quizzes.create(lessonId, asAuthUser(instructor), {
        title: 'แบบทดสอบที่ไม่มีเฉลย',
        passScore: 70,
        questions: [
          {
            questionText: 'คำถามที่ไม่มีคำตอบถูก',
            choices: [
              { choiceText: 'ก', isCorrect: false },
              { choiceText: 'ข', isCorrect: false },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'QUIZ_QUESTION_INVALID' });

    await expect(
      quizzes.create(lessonId, asAuthUser(instructor), {
        title: 'แบบทดสอบที่มีสองเฉลย',
        passScore: 70,
        questions: [
          {
            questionText: 'คำถามที่มีคำตอบถูกสองข้อ',
            choices: [
              { choiceText: 'ก', isCorrect: true },
              { choiceText: 'ข', isCorrect: true },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'QUIZ_QUESTION_INVALID' });
  });

  it("refuses to let one instructor touch another instructor's quiz", async () => {
    const other = await createUser(prisma, { role: 'INSTRUCTOR' });
    const quiz = await quizzes.create(lessonId, asAuthUser(instructor), quizInput);

    await expect(
      quizzes.update(quiz.id, asAuthUser(other), { title: 'ชื่อใหม่' }),
    ).rejects.toMatchObject({ code: 'NOT_COURSE_OWNER' });
    await expect(quizzes.remove(quiz.id, asAuthUser(other))).rejects.toMatchObject({
      code: 'NOT_COURSE_OWNER',
    });
  });

  it('replaces every question when the update carries a new set', async () => {
    const quiz = await quizzes.create(lessonId, asAuthUser(instructor), quizInput);

    const updated = await quizzes.update(quiz.id, asAuthUser(instructor), {
      passScore: 80,
      questions: [
        {
          questionText: 'คำถามที่เขียนใหม่ทั้งหมด',
          choices: [
            { choiceText: 'ใช่', isCorrect: true },
            { choiceText: 'ไม่ใช่', isCorrect: false },
          ],
        },
      ],
    });

    expect(updated.passScore).toBe(80);
    expect(updated.questionCount).toBe(1);
    expect(updated.questions[0]?.questionText).toBe('คำถามที่เขียนใหม่ทั้งหมด');
    // The old question is gone, not orphaned.
    expect(await prisma.quizQuestion.count({ where: { quizId: quiz.id } })).toBe(1);
  });

  it('freezes a quiz once somebody has sat it', async () => {
    const quiz = await quizzes.create(lessonId, asAuthUser(instructor), quizInput);
    const key = await readKey(prisma, quiz.id);
    await quizzes.submit(quiz.id, student.id, {
      answers: [{ questionId: key[0].questionId, choiceId: key[0].correctChoiceId }],
    });

    await expect(
      quizzes.update(quiz.id, asAuthUser(instructor), { title: 'ชื่อใหม่' }),
    ).rejects.toMatchObject({ code: 'QUIZ_HAS_ATTEMPTS' });
    await expect(quizzes.remove(quiz.id, asAuthUser(instructor))).rejects.toMatchObject({
      code: 'QUIZ_HAS_ATTEMPTS',
    });
  });

  it('deletes a quiz nobody has sat', async () => {
    const quiz = await quizzes.create(lessonId, asAuthUser(instructor), quizInput);

    await quizzes.remove(quiz.id, asAuthUser(instructor));

    expect(await prisma.quiz.count({ where: { id: quiz.id } })).toBe(0);
  });

  // --- taking it -----------------------------------------------------------

  it('never sends isCorrect while the quiz is being answered', async () => {
    const quizId = await createQuiz(prisma, { lessonId, questions: 4 });

    const paper = await quizzes.take(quizId, student.id);

    // Not "no field named isCorrect" — no occurrence of the string anywhere in
    // the payload, however it might have been nested (PLAN.md, เฟส 6).
    expect(JSON.stringify(paper)).not.toContain('isCorrect');
    expect(paper.questionCount).toBe(4);
    expect(paper.questions[0]?.choices).toHaveLength(4);
  });

  it('refuses the paper to somebody who has not bought the course', async () => {
    const outsider = await createUser(prisma, { role: 'STUDENT' });
    const quizId = await createQuiz(prisma, { lessonId, questions: 2 });

    await expect(quizzes.take(quizId, outsider.id)).rejects.toMatchObject({
      code: 'NOT_ENROLLED',
    });
    await expect(quizzes.listMyAttempts(quizId, outsider.id)).rejects.toMatchObject({
      code: 'NOT_ENROLLED',
    });
  });

  // --- grading -------------------------------------------------------------

  it('scores every answer right as 100 and passes', async () => {
    const quizId = await createQuiz(prisma, { lessonId, questions: 4, passScore: 70 });
    const key = await readKey(prisma, quizId);

    const result = await quizzes.submit(quizId, student.id, {
      answers: key.map((item) => ({
        questionId: item.questionId,
        choiceId: item.correctChoiceId,
      })),
    });

    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.correctCount).toBe(4);
    expect(result.questions.every((question) => question.isCorrect)).toBe(true);
  });

  it('scores three of four as 75 and fails a pass mark of 80', async () => {
    const quizId = await createQuiz(prisma, { lessonId, questions: 4, passScore: 80 });
    const key = await readKey(prisma, quizId);

    const result = await quizzes.submit(quizId, student.id, {
      answers: key.map((item, index) => ({
        questionId: item.questionId,
        choiceId: index === 3 ? item.wrongChoiceId : item.correctChoiceId,
      })),
    });

    expect(result.score).toBe(75);
    expect(result.passed).toBe(false);
    expect(result.correctCount).toBe(3);
    expect(result.questions[3]?.isCorrect).toBe(false);
    // The review names the right answer, which is the point of the page.
    expect(result.questions[3]?.correctChoiceId).toBe(key[3]?.correctChoiceId);
  });

  it('passes on exactly the pass mark', async () => {
    const quizId = await createQuiz(prisma, { lessonId, questions: 4, passScore: 75 });
    const key = await readKey(prisma, quizId);

    const result = await quizzes.submit(quizId, student.id, {
      answers: key.map((item, index) => ({
        questionId: item.questionId,
        choiceId: index === 0 ? item.wrongChoiceId : item.correctChoiceId,
      })),
    });

    expect(result.score).toBe(75);
    expect(result.passed).toBe(true);
  });

  it('grades on the server even when the client sends nothing but choice ids', async () => {
    const quizId = await createQuiz(prisma, { lessonId, questions: 3, passScore: 100 });
    const key = await readKey(prisma, quizId);

    const result = await quizzes.submit(quizId, student.id, {
      answers: key.map((item) => ({
        questionId: item.questionId,
        choiceId: item.wrongChoiceId,
      })),
    });

    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
    // The stored row agrees with what was returned: no way to talk it up.
    const stored = await prisma.quizAttempt.findUniqueOrThrow({
      where: { id: result.attemptId },
      select: { score: true, passed: true },
    });
    expect(stored).toEqual({ score: 0, passed: false });
  });

  it('refuses a submission that skips a question', async () => {
    const quizId = await createQuiz(prisma, { lessonId, questions: 3 });
    const key = await readKey(prisma, quizId);

    await expect(
      quizzes.submit(quizId, student.id, {
        answers: [
          { questionId: key[0].questionId, choiceId: key[0].correctChoiceId },
          { questionId: key[1].questionId, choiceId: key[1].correctChoiceId },
        ],
      }),
    ).rejects.toMatchObject({ code: 'QUIZ_ANSWER_MISMATCH' });

    expect(await prisma.quizAttempt.count({ where: { quizId } })).toBe(0);
  });

  it('refuses a choice borrowed from another question', async () => {
    const quizId = await createQuiz(prisma, { lessonId, questions: 2 });
    const key = await readKey(prisma, quizId);

    await expect(
      quizzes.submit(quizId, student.id, {
        answers: [
          { questionId: key[0].questionId, choiceId: key[1].correctChoiceId },
          { questionId: key[1].questionId, choiceId: key[1].correctChoiceId },
        ],
      }),
    ).rejects.toMatchObject({ code: 'QUIZ_ANSWER_MISMATCH' });
  });

  it('refuses to grade for somebody who has not bought the course', async () => {
    const outsider = await createUser(prisma, { role: 'STUDENT' });
    const quizId = await createQuiz(prisma, { lessonId, questions: 1 });
    const key = await readKey(prisma, quizId);

    await expect(
      quizzes.submit(quizId, outsider.id, {
        answers: [{ questionId: key[0].questionId, choiceId: key[0].correctChoiceId }],
      }),
    ).rejects.toMatchObject({ code: 'NOT_ENROLLED' });
  });

  // --- retakes and history -------------------------------------------------

  it('keeps every attempt and reports the best score', async () => {
    const quizId = await createQuiz(prisma, { lessonId, questions: 4, passScore: 70 });
    const key = await readKey(prisma, quizId);

    // Two wrong, then one wrong, then none.
    for (const wrongCount of [2, 1, 0]) {
      await quizzes.submit(quizId, student.id, {
        answers: key.map((item, index) => ({
          questionId: item.questionId,
          choiceId: index < wrongCount ? item.wrongChoiceId : item.correctChoiceId,
        })),
      });
    }

    const history = await quizzes.listMyAttempts(quizId, student.id);

    expect(history.attemptCount).toBe(3);
    expect(history.attempts.map((attempt) => attempt.score)).toEqual([100, 75, 50]);
    expect(history.attempts.map((attempt) => attempt.attemptNo)).toEqual([3, 2, 1]);
    expect(history.bestScore).toBe(100);
    expect(history.hasPassed).toBe(true);
  });

  it('reports no score at all before the first attempt', async () => {
    const quizId = await createQuiz(prisma, { lessonId, questions: 2 });

    const history = await quizzes.listMyAttempts(quizId, student.id);

    expect(history.attemptCount).toBe(0);
    expect(history.bestScore).toBeNull();
    expect(history.hasPassed).toBe(false);
    expect(history.latestResult).toBeNull();
  });

  it('reviews the latest attempt, answer by answer', async () => {
    const quizId = await createQuiz(prisma, { lessonId, questions: 3, passScore: 70 });
    const key = await readKey(prisma, quizId);

    await quizzes.submit(quizId, student.id, {
      answers: key.map((item) => ({
        questionId: item.questionId,
        choiceId: item.correctChoiceId,
      })),
    });
    const second = await quizzes.submit(quizId, student.id, {
      answers: key.map((item, index) => ({
        questionId: item.questionId,
        choiceId: index === 0 ? item.wrongChoiceId : item.correctChoiceId,
      })),
    });

    const history = await quizzes.listMyAttempts(quizId, student.id);

    expect(history.latestResult?.attemptId).toBe(second.attemptId);
    expect(history.latestResult?.correctCount).toBe(2);
    expect(history.latestResult?.questions[0]?.selectedChoiceId).toBe(key[0]?.wrongChoiceId);
    expect(history.latestResult?.questions[0]?.isCorrect).toBe(false);
    // A failed retake does not undo an earlier pass.
    expect(history.bestScore).toBe(100);
    expect(history.hasPassed).toBe(true);
  });

  it("shows one student nothing of another student's attempts", async () => {
    const other = await createUser(prisma, { role: 'STUDENT' });
    await enrol(prisma, { courseId, studentId: other.id });

    const quizId = await createQuiz(prisma, { lessonId, questions: 2 });
    const key = await readKey(prisma, quizId);
    await quizzes.submit(quizId, other.id, {
      answers: key.map((item) => ({
        questionId: item.questionId,
        choiceId: item.correctChoiceId,
      })),
    });

    const mine = await quizzes.listMyAttempts(quizId, student.id);

    expect(mine.attemptCount).toBe(0);
    expect(mine.attempts).toHaveLength(0);
  });
});
