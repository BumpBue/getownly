import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Role } from '@prisma/client';
import { QUIZ_PASS_SCORE_MAX, QUIZ_PASS_SCORE_MIN } from '@getownly/shared';
import { ACCESS_TOKEN_COOKIE } from '@/common/cookies';
import { PrismaService } from '@/infra/prisma.service';
import { createHarness, cookieHeader, cookiesFrom, type Harness } from './app-harness';
import { createCategory, createCourse, createLesson, enrol, resetDatabase } from './factories';

/**
 * ทก.01 A7, over real HTTP.
 *
 * The point of going through the API rather than the service is (ก): every
 * guard rail the authoring form has must also exist on the server, so a
 * crafted request cannot store a quiz the form would have refused.
 */
describe('Quiz authoring (e2e)', () => {
  let harness: Harness;
  let prisma: PrismaService;
  let categoryId: string;

  beforeAll(async () => {
    harness = await createHarness();
    prisma = harness.prisma;
  });

  afterAll(async () => {
    await harness.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    harness.resetRateLimits();
    categoryId = await createCategory(prisma);
  });

  let sequence = 0;

  async function signUp(role: Role): Promise<{ id: string; cookie: string }> {
    sequence += 1;
    const handle = `quiz${sequence}`;

    const response = await request(harness.server)
      .post('/api/auth/register')
      .send({
        email: `${handle}@test.local`,
        username: handle,
        password: 'Password@1234',
        displayName: `ผู้ใช้ ${handle}`,
        role,
      })
      .expect(201);

    return {
      id: response.body.user.id as string,
      cookie: cookieHeader(cookiesFrom(response), [ACCESS_TOKEN_COOKIE]),
    };
  }

  /** A course belonging to `instructorId`, with one lesson to hang a quiz on. */
  async function courseWithLesson(
    instructorId: string,
  ): Promise<{ lessonId: string; courseId: string }> {
    const courseId = await createCourse(prisma, { instructorId, categoryId, price: '0.00' });
    const lessonId = await createLesson(prisma, { courseId, orderIndex: 1 });
    return { lessonId, courseId };
  }

  function question(text = 'ข้อใดคือคำตอบที่ถูกต้องของคำถามนี้') {
    return {
      questionText: text,
      choices: [
        { choiceText: 'ตัวเลือกที่ถูก', isCorrect: true },
        { choiceText: 'ตัวเลือกที่ผิด', isCorrect: false },
      ],
    };
  }

  function validQuiz(overrides: Record<string, unknown> = {}) {
    return {
      title: 'แบบทดสอบท้ายบทเรียน',
      passScore: 70,
      questions: [question()],
      ...overrides,
    };
  }

  function create(lessonId: string, cookie: string, body: object): request.Test {
    return request(harness.server)
      .post(`/api/lessons/${lessonId}/quiz`)
      .set('Cookie', cookie)
      .send(body);
  }

  // -------------------------------------------------------------------------
  // (ก) every guard rail also lives on the server
  // -------------------------------------------------------------------------

  describe('(ก) guard rails the form has, the API has too', () => {
    let instructor: { id: string; cookie: string };
    let lessonId: string;

    beforeEach(async () => {
      instructor = await signUp(Role.INSTRUCTOR);
      ({ lessonId } = await courseWithLesson(instructor.id));
    });

    it('refuses a question with no correct choice ticked, naming the question', async () => {
      const response = await create(
        lessonId,
        instructor.cookie,
        validQuiz({
          questions: [
            question(),
            {
              questionText: 'คำถามข้อที่สองที่ยังไม่ได้ติ๊กเฉลย',
              choices: [
                { choiceText: 'ตัวเลือกหนึ่ง', isCorrect: false },
                { choiceText: 'ตัวเลือกสอง', isCorrect: false },
              ],
            },
          ],
        }),
      ).expect(422);

      expect(response.body.code).toBe('QUIZ_QUESTION_INVALID');
      expect(response.body.details).toMatchObject({
        questionIndex: 1,
        problem: 'NO_CORRECT_CHOICE',
      });
      // Says which question, not "ข้อมูลไม่ถูกต้อง".
      expect(response.body.message).toContain('ข้อที่ 2');
    });

    it('refuses a question with two correct choices ticked', async () => {
      const response = await create(
        lessonId,
        instructor.cookie,
        validQuiz({
          questions: [
            {
              questionText: 'คำถามที่ติ๊กเฉลยไว้สองตัวเลือก',
              choices: [
                { choiceText: 'ตัวเลือกหนึ่ง', isCorrect: true },
                { choiceText: 'ตัวเลือกสอง', isCorrect: true },
              ],
            },
          ],
        }),
      ).expect(422);

      expect(response.body.details).toMatchObject({
        questionIndex: 0,
        problem: 'MANY_CORRECT_CHOICES',
      });
    });

    it('refuses two identical choices inside one question', async () => {
      const response = await create(
        lessonId,
        instructor.cookie,
        validQuiz({
          questions: [
            {
              questionText: 'คำถามที่มีตัวเลือกซ้ำกันสองตัว',
              choices: [
                { choiceText: 'คำตอบเดียวกัน', isCorrect: true },
                { choiceText: 'คำตอบเดียวกัน', isCorrect: false },
              ],
            },
          ],
        }),
      ).expect(422);

      expect(response.body.details).toMatchObject({
        questionIndex: 0,
        problem: 'DUPLICATE_CHOICE',
      });
    });

    it('treats choices differing only in surrounding spaces as duplicates', async () => {
      const response = await create(
        lessonId,
        instructor.cookie,
        validQuiz({
          questions: [
            {
              questionText: 'คำถามที่มีตัวเลือกซ้ำแบบมีช่องว่าง',
              choices: [
                { choiceText: 'คำตอบ', isCorrect: true },
                { choiceText: '  คำตอบ  ', isCorrect: false },
              ],
            },
          ],
        }),
      ).expect(422);

      expect(response.body.details).toMatchObject({ problem: 'DUPLICATE_CHOICE' });
    });

    it('refuses blank and whitespace-only text', async () => {
      const blankQuestion = await create(
        lessonId,
        instructor.cookie,
        validQuiz({ questions: [{ ...question(), questionText: '     ' }] }),
      ).expect(400);
      // Keyed down to the exact field, so the form knows what to highlight.
      expect(Object.keys(blankQuestion.body.errors)).toContain('questions.0.questionText');

      const blankChoice = await create(
        lessonId,
        instructor.cookie,
        validQuiz({
          questions: [
            {
              questionText: 'คำถามที่ตัวเลือกหนึ่งเป็นช่องว่าง',
              choices: [
                { choiceText: '   ', isCorrect: true },
                { choiceText: 'ตัวเลือกที่ผิด', isCorrect: false },
              ],
            },
          ],
        }),
      ).expect(400);
      expect(Object.keys(blankChoice.body.errors).join(' ')).toContain('choices.0.choiceText');

      const blankTitle = await create(lessonId, instructor.cookie, validQuiz({ title: '  ' }));
      expect(blankTitle.status).toBe(400);
    });

    it('refuses fewer than two choices and more than six', async () => {
      const tooFew = await create(
        lessonId,
        instructor.cookie,
        validQuiz({
          questions: [
            {
              questionText: 'คำถามที่มีตัวเลือกเดียว',
              choices: [{ choiceText: 'ตัวเลือกเดียว', isCorrect: true }],
            },
          ],
        }),
      ).expect(400);
      expect(Object.keys(tooFew.body.errors)).toContain('questions.0.choices');

      const tooMany = await create(
        lessonId,
        instructor.cookie,
        validQuiz({
          questions: [
            {
              questionText: 'คำถามที่มีตัวเลือกเจ็ดตัว',
              choices: Array.from({ length: 7 }, (_, index) => ({
                choiceText: `ตัวเลือกที่ ${index + 1}`,
                isCorrect: index === 0,
              })),
            },
          ],
        }),
      ).expect(400);
      expect(Object.keys(tooMany.body.errors)).toContain('questions.0.choices');
    });

    it('refuses a quiz with no questions at all', async () => {
      const response = await create(lessonId, instructor.cookie, validQuiz({ questions: [] }));

      expect(response.status).toBe(400);
      expect(Object.keys(response.body.errors)).toContain('questions');
      expect(await prisma.quiz.count()).toBe(0);
    });

    it('stores nothing at all when a payload is refused', async () => {
      await create(lessonId, instructor.cookie, validQuiz({ questions: [] }));
      await create(
        lessonId,
        instructor.cookie,
        validQuiz({
          questions: [
            { ...question(), choices: question().choices.map((c) => ({ ...c, isCorrect: false })) },
          ],
        }),
      );

      expect(await prisma.quiz.count()).toBe(0);
      expect(await prisma.quizQuestion.count()).toBe(0);
      expect(await prisma.quizChoice.count()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // (ข) the pass mark range
  // -------------------------------------------------------------------------

  it('(ข) accepts 60 and 100 and refuses 59 and 101', async () => {
    const instructor = await signUp(Role.INSTRUCTOR);

    for (const passScore of [QUIZ_PASS_SCORE_MIN, QUIZ_PASS_SCORE_MAX]) {
      const { lessonId } = await courseWithLesson(instructor.id);
      await create(lessonId, instructor.cookie, validQuiz({ passScore })).expect(201);
    }

    for (const passScore of [QUIZ_PASS_SCORE_MIN - 1, QUIZ_PASS_SCORE_MAX + 1]) {
      const { lessonId } = await courseWithLesson(instructor.id);
      const response = await create(lessonId, instructor.cookie, validQuiz({ passScore }));
      expect(response.status).toBe(400);
      expect(Object.keys(response.body.errors)).toContain('passScore');
    }
  });

  // -------------------------------------------------------------------------
  // (ค) and (ง) who may author
  // -------------------------------------------------------------------------

  it('(ค) refuses all three verbs on another instructor course', async () => {
    const mine = await signUp(Role.INSTRUCTOR);
    const theirs = await signUp(Role.INSTRUCTOR);

    const { lessonId } = await courseWithLesson(theirs.id);
    const created = await create(lessonId, theirs.cookie, validQuiz()).expect(201);
    const quizId = created.body.id as string;

    await create(lessonId, mine.cookie, validQuiz()).expect(403);
    await request(harness.server)
      .patch(`/api/quizzes/${quizId}`)
      .set('Cookie', mine.cookie)
      .send({ title: 'ชื่อที่ไม่ควรเปลี่ยนได้' })
      .expect(403);
    await request(harness.server)
      .delete(`/api/quizzes/${quizId}`)
      .set('Cookie', mine.cookie)
      .expect(403);

    // Nothing about it moved.
    const untouched = await prisma.quiz.findUniqueOrThrow({ where: { id: quizId } });
    expect(untouched.title).toBe('แบบทดสอบท้ายบทเรียน');
  });

  it('(ง) refuses a student on all three verbs, and a caller with no session', async () => {
    const instructor = await signUp(Role.INSTRUCTOR);
    const student = await signUp(Role.STUDENT);

    const { lessonId, courseId } = await courseWithLesson(instructor.id);
    const created = await create(lessonId, instructor.cookie, validQuiz()).expect(201);
    const quizId = created.body.id as string;

    // Enrolled, so this is about the role and not about access to the course.
    await enrol(prisma, { courseId, studentId: student.id });

    await create(lessonId, student.cookie, validQuiz()).expect(403);
    await request(harness.server)
      .patch(`/api/quizzes/${quizId}`)
      .set('Cookie', student.cookie)
      .send({ title: 'ชื่อใหม่' })
      .expect(403);
    await request(harness.server)
      .delete(`/api/quizzes/${quizId}`)
      .set('Cookie', student.cookie)
      .expect(403);

    await create(lessonId, '', validQuiz()).expect(401);
  });

  // -------------------------------------------------------------------------
  // (จ) and (ฉ) the quiz an instructor made is the quiz students sit
  // -------------------------------------------------------------------------

  it('(จ) grades a quiz the instructor just authored', async () => {
    const instructor = await signUp(Role.INSTRUCTOR);
    const student = await signUp(Role.STUDENT);
    const { lessonId, courseId } = await courseWithLesson(instructor.id);
    await enrol(prisma, { courseId, studentId: student.id });

    const created = await create(
      lessonId,
      instructor.cookie,
      validQuiz({
        passScore: 60,
        questions: [
          {
            questionText: 'สองบวกสองเท่ากับเท่าไร',
            choices: [
              { choiceText: 'สี่', isCorrect: true },
              { choiceText: 'ห้า', isCorrect: false },
            ],
          },
          {
            questionText: 'สามคูณสามเท่ากับเท่าไร',
            choices: [
              { choiceText: 'เก้า', isCorrect: true },
              { choiceText: 'หก', isCorrect: false },
            ],
          },
        ],
      }),
    ).expect(201);
    const quizId = created.body.id as string;

    const paper = await request(harness.server)
      .get(`/api/quizzes/${quizId}/take`)
      .set('Cookie', student.cookie)
      .expect(200);

    // The answer key never reaches the student.
    expect(JSON.stringify(paper.body)).not.toContain('isCorrect');

    const key = await prisma.quizChoice.findMany({
      where: { question: { quizId }, isCorrect: true },
      select: { id: true, questionId: true },
    });

    const allRight = await request(harness.server)
      .post(`/api/quizzes/${quizId}/submit`)
      .set('Cookie', student.cookie)
      .send({ answers: key.map((c) => ({ questionId: c.questionId, choiceId: c.id })) })
      .expect(201);

    expect(allRight.body.score).toBe(100);
    expect(allRight.body.passed).toBe(true);

    // One right, one wrong: 50, below the mark of 60.
    const wrong = await prisma.quizChoice.findFirstOrThrow({
      where: { questionId: key[1].questionId, isCorrect: false },
      select: { id: true },
    });
    const half = await request(harness.server)
      .post(`/api/quizzes/${quizId}/submit`)
      .set('Cookie', student.cookie)
      .send({
        answers: [
          { questionId: key[0].questionId, choiceId: key[0].id },
          { questionId: key[1].questionId, choiceId: wrong.id },
        ],
      })
      .expect(201);

    expect(half.body.score).toBe(50);
    expect(half.body.passed).toBe(false);

    // Graded on the server, with the mark that applied written down with it.
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId },
      select: { score: true, passed: true, passScoreSnapshot: true },
      orderBy: { score: 'asc' },
    });
    expect(attempts).toEqual([
      { score: 50, passed: false, passScoreSnapshot: 60 },
      { score: 100, passed: true, passScoreSnapshot: 60 },
    ]);
  });

  it('(ฉ) gives every student the same one paper, with no bank to draw from', async () => {
    const instructor = await signUp(Role.INSTRUCTOR);
    const first = await signUp(Role.STUDENT);
    const second = await signUp(Role.STUDENT);
    const { lessonId, courseId } = await courseWithLesson(instructor.id);
    await enrol(prisma, { courseId, studentId: first.id });
    await enrol(prisma, { courseId, studentId: second.id });

    const created = await create(
      lessonId,
      instructor.cookie,
      validQuiz({
        questions: [
          question('คำถามข้อที่หนึ่งของแบบทดสอบชุดนี้'),
          question('คำถามข้อที่สองของแบบทดสอบชุดนี้'),
          question('คำถามข้อที่สามของแบบทดสอบชุดนี้'),
        ],
      }),
    ).expect(201);
    const quizId = created.body.id as string;

    const papers = await Promise.all(
      [first, second].map((who) =>
        request(harness.server)
          .get(`/api/quizzes/${quizId}/take`)
          .set('Cookie', who.cookie)
          .expect(200),
      ),
    );

    const shape = (body: {
      questions: { questionText: string; choices: { choiceText: string }[] }[];
    }) =>
      body.questions.map((q) => ({
        questionText: q.questionText,
        choices: q.choices.map((c) => c.choiceText),
      }));

    // Identical question by question and choice by choice, in the same order:
    // one fixed paper, not a sample drawn per student (ทก.01 D4).
    expect(shape(papers[0].body)).toEqual(shape(papers[1].body));
    expect(shape(papers[0].body)).toHaveLength(3);

    // And a second quiz cannot be attached to the same lesson.
    await create(lessonId, instructor.cookie, validQuiz({ title: 'ชุดที่สอง' })).expect(409);
    expect(await prisma.quiz.count({ where: { lessonId } })).toBe(1);
  });
});
