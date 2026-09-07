import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '@/infra/prisma.service';
import { LearnService } from '@/modules/learn/learn.service';
import { LedgerService } from '@/modules/ledger/ledger.service';
import { WalletService } from '@/modules/ledger/wallet.service';
import { CourseAccessService } from './course-access.service';
import { CourseStudentsService } from './course-students.service';
import {
  createCategory,
  createCourse,
  createLesson,
  createQuiz,
  createSystemAccounts,
  createUser,
  enrol,
  fundWallet,
  resetDatabase,
  type TestUser,
} from '../../../test/factories';
import { FakeStorage } from '../../../test/fake-storage';

/**
 * ทก.01 A9: the roster an instructor reads.
 *
 * The test that matters most is the first one: whatever number this service
 * quotes an instructor has to be the number the student is looking at in their
 * own classroom, so both are asked in the same test and compared directly.
 */
describe('CourseStudentsService', () => {
  let prisma: PrismaService;
  let students: CourseStudentsService;
  let learn: LearnService;
  let wallet: WalletService;

  let admin: TestUser;
  let instructor: TestUser;
  let categoryId: string;
  let courseId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);

    const access = new CourseAccessService(prisma);
    students = new CourseStudentsService(prisma);
    learn = new LearnService(prisma, new FakeStorage().asService(), access);
    wallet = new WalletService(prisma, new LedgerService(prisma));

    await createSystemAccounts(prisma);
    admin = await createUser(prisma, { role: 'ADMIN' });
    instructor = await createUser(prisma, { role: 'INSTRUCTOR' });
    categoryId = await createCategory(prisma);
    courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '500.00',
    });
  });

  /** Enrols a fresh student by buying the course with real money. */
  async function buyer(): Promise<TestUser> {
    const student = await createUser(prisma, { role: 'STUDENT' });
    await fundWallet(prisma, wallet, {
      studentId: student.id,
      adminId: admin.id,
      amount: '5000.00',
    });
    await wallet.purchaseCourse(student.id, courseId);
    return student;
  }

  async function completeLesson(studentId: string, lessonId: string): Promise<void> {
    await learn.complete(lessonId, studentId);
  }

  // --- (ก) the number both sides see ----------------------------------------

  it('(ก) quotes the instructor exactly the percentage the student sees', async () => {
    const lessons = await Promise.all([
      createLesson(prisma, { courseId, orderIndex: 1 }),
      createLesson(prisma, { courseId, orderIndex: 2 }),
      createLesson(prisma, { courseId, orderIndex: 3 }),
    ]);

    const student = await buyer();
    await completeLesson(student.id, lessons[0]);

    const roster = await students.listForCourse(courseId, {});
    const classroom = await learn.getRoom(courseId, student.id);

    // One lesson of three: 33% both ways, because both call the same function.
    expect(roster.items[0].progressPercent).toBe(classroom.progressPercent);
    expect(roster.items[0].progressPercent).toBe(33);
    expect(roster.items[0].completedLessonCount).toBe(classroom.completedLessonCount);
    expect(roster.items[0].lessonCount).toBe(classroom.lessonCount);
  });

  it('(ก) still agrees once every lesson is finished', async () => {
    const lessons = await Promise.all([
      createLesson(prisma, { courseId, orderIndex: 1 }),
      createLesson(prisma, { courseId, orderIndex: 2 }),
    ]);

    const student = await buyer();
    for (const lessonId of lessons) {
      await completeLesson(student.id, lessonId);
    }

    const roster = await students.listForCourse(courseId, {});
    const classroom = await learn.getRoom(courseId, student.id);

    expect(roster.items[0].progressPercent).toBe(classroom.progressPercent);
    expect(roster.items[0].progressPercent).toBe(100);
  });

  // --- (ข) free enrolments --------------------------------------------------

  it('(ข) lists a student who enrolled for free alongside one who paid', async () => {
    const freeCourseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '0.00',
    });
    await createLesson(prisma, { courseId: freeCourseId, orderIndex: 1 });

    const freeStudent = await createUser(prisma, { role: 'STUDENT', displayName: 'คนเรียนฟรี' });
    await wallet.purchaseCourse(freeStudent.id, freeCourseId);

    const roster = await students.listForCourse(freeCourseId, {});

    // No money moved, so there is no ledger row — but the person is enrolled,
    // and the roster is about who is learning, not about who paid.
    expect(roster.total).toBe(1);
    expect(roster.items[0].displayName).toBe('คนเรียนฟรี');
  });

  // --- (ค) never sat vs. sat and scored nothing -----------------------------

  it('(ค) tells "not attempted" apart from "attempted and scored zero"', async () => {
    const lessonA = await createLesson(prisma, { courseId, orderIndex: 1 });
    const lessonB = await createLesson(prisma, { courseId, orderIndex: 2 });

    const quizA = await createQuiz(prisma, {
      lessonId: lessonA,
      questions: 2,
      title: 'ชุดที่ทำแล้ว',
    });
    await createQuiz(prisma, { lessonId: lessonB, questions: 2, title: 'ชุดที่ยังไม่ทำ' });

    const student = await buyer();

    // Sat quiz A and got everything wrong; never opened quiz B at all.
    await prisma.quizAttempt.create({
      data: { quizId: quizA, studentId: student.id, score: 0, passed: false },
    });

    const roster = await students.listForCourse(courseId, {});
    const byTitle = new Map(roster.items[0].quizzes.map((quiz) => [quiz.quizTitle, quiz]));

    expect(byTitle.get('ชุดที่ทำแล้ว')).toMatchObject({
      bestScore: 0,
      attemptCount: 1,
      hasPassed: false,
    });
    expect(byTitle.get('ชุดที่ยังไม่ทำ')).toMatchObject({
      bestScore: null,
      attemptCount: 0,
      hasPassed: false,
    });
  });

  // --- (ง) best, not latest -------------------------------------------------

  it('(ง) reports the best attempt, not the most recent one', async () => {
    const lessonId = await createLesson(prisma, { courseId, orderIndex: 1 });
    const quiz = await createQuiz(prisma, { lessonId, questions: 4, passScore: 60 });

    const student = await buyer();

    for (const score of [40, 100, 25]) {
      await prisma.quizAttempt.create({
        data: { quizId: quiz, studentId: student.id, score, passed: score >= 60 },
      });
    }

    const roster = await students.listForCourse(courseId, {});
    const [standing] = roster.items[0].quizzes;

    // The last attempt scored 25 and failed; the best scored 100 and passed.
    expect(standing.bestScore).toBe(100);
    expect(standing.attemptCount).toBe(3);
    expect(standing.hasPassed).toBe(true);
    expect(roster.items[0].passedQuizCount).toBe(1);
  });

  it('counts passed quizzes against every quiz in the course', async () => {
    const lessonA = await createLesson(prisma, { courseId, orderIndex: 1 });
    const lessonB = await createLesson(prisma, { courseId, orderIndex: 2 });
    const passed = await createQuiz(prisma, { lessonId: lessonA, questions: 2, passScore: 60 });
    await createQuiz(prisma, { lessonId: lessonB, questions: 2, passScore: 60 });

    const student = await buyer();
    await prisma.quizAttempt.create({
      data: { quizId: passed, studentId: student.id, score: 80, passed: true },
    });

    const roster = await students.listForCourse(courseId, {});

    expect(roster.items[0].passedQuizCount).toBe(1);
    expect(roster.items[0].quizCount).toBe(2);
    expect(roster.quizCount).toBe(2);
  });

  // --- (ช) pagination -------------------------------------------------------

  it('(ช) pages 25 students as 20 then 5, with nobody repeated or lost', async () => {
    for (let index = 0; index < 25; index += 1) {
      const student = await createUser(prisma, { role: 'STUDENT' });
      await enrol(prisma, { courseId, studentId: student.id });
    }

    const first = await students.listForCourse(courseId, { page: 1 });
    const second = await students.listForCourse(courseId, { page: 2 });

    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(5);
    expect(first.total).toBe(25);
    expect(first.totalPages).toBe(2);

    const seen = [...first.items, ...second.items].map((item) => item.enrollmentId);
    expect(new Set(seen).size).toBe(25);
  });

  it('orders newest enrolment first', async () => {
    const older = await createUser(prisma, { role: 'STUDENT', displayName: 'มาก่อน' });
    await enrol(prisma, { courseId, studentId: older.id });
    const newer = await createUser(prisma, { role: 'STUDENT', displayName: 'มาทีหลัง' });
    await enrol(prisma, { courseId, studentId: newer.id });

    const roster = await students.listForCourse(courseId, {});

    expect(roster.items.map((item) => item.displayName)).toEqual(['มาทีหลัง', 'มาก่อน']);
  });

  // --- (ซ) suspended accounts ----------------------------------------------

  it('(ซ) keeps a suspended student on the roster', async () => {
    const student = await buyer();
    await prisma.user.update({
      where: { id: student.id },
      data: { status: UserStatus.SUSPENDED },
    });

    const roster = await students.listForCourse(courseId, {});

    // They enrolled and the sale happened; hiding them would make the roster
    // disagree with the earnings table about how many people bought this.
    expect(roster.total).toBe(1);
    expect(roster.items[0].studentId).toBe(student.id);
  });

  // --- privacy and empty states --------------------------------------------

  it('carries no email address or other contact detail', async () => {
    await buyer();

    const roster = await students.listForCourse(courseId, {});

    expect(JSON.stringify(roster)).not.toContain('@');
    expect(roster.items[0]).not.toHaveProperty('email');
    expect(roster.items[0]).not.toHaveProperty('username');
  });

  it('returns an empty page for a course nobody has enrolled in', async () => {
    await createLesson(prisma, { courseId, orderIndex: 1 });

    const roster = await students.listForCourse(courseId, {});

    expect(roster).toMatchObject({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
      lessonCount: 1,
      quizCount: 0,
    });
  });

  it('reports 0% rather than NaN for a course with no lessons yet', async () => {
    await buyer();

    const roster = await students.listForCourse(courseId, {});

    expect(roster.items[0].progressPercent).toBe(0);
    expect(roster.items[0].lessonCount).toBe(0);
  });

  it('counts only lessons this student finished, not another student', async () => {
    const lessons = await Promise.all([
      createLesson(prisma, { courseId, orderIndex: 1 }),
      createLesson(prisma, { courseId, orderIndex: 2 }),
    ]);

    const busy = await buyer();
    const idle = await buyer();
    await completeLesson(busy.id, lessons[0]);
    await completeLesson(busy.id, lessons[1]);

    const roster = await students.listForCourse(courseId, {});
    const byId = new Map(roster.items.map((item) => [item.studentId, item]));

    expect(byId.get(busy.id)?.progressPercent).toBe(100);
    expect(byId.get(idle.id)?.progressPercent).toBe(0);
  });
});
