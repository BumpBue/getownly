import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/infra/prisma.service';
import { CourseAccessService } from '@/modules/courses/course-access.service';
import { LearnService } from './learn.service';
import {
  createCategory,
  createCourse,
  createLesson,
  createMaterial,
  createQuiz,
  createUser,
  enrol,
  resetDatabase,
  type TestUser,
} from '../../../test/factories';
import { FakeStorage } from '../../../test/fake-storage';

describe('LearnService', () => {
  let prisma: PrismaService;
  let storage: FakeStorage;
  let learn: LearnService;

  let instructor: TestUser;
  let student: TestUser;
  let courseId: string;
  let lessonIds: string[];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    storage = new FakeStorage();
    learn = new LearnService(prisma, storage.asService(), new CourseAccessService(prisma));

    instructor = await createUser(prisma, { role: 'INSTRUCTOR', displayName: 'ครูทดสอบ' });
    student = await createUser(prisma, { role: 'STUDENT' });

    const categoryId = await createCategory(prisma);
    courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '1000.00',
      title: 'คอร์สห้องเรียน',
    });

    lessonIds = [];
    for (let index = 1; index <= 4; index += 1) {
      lessonIds.push(await createLesson(prisma, { courseId, orderIndex: index, durationSec: 600 }));
    }

    await enrol(prisma, { courseId, studentId: student.id });
  });

  // --- the classroom -------------------------------------------------------

  it('opens the classroom at the first lesson when nothing has been watched', async () => {
    const room = await learn.getRoom(courseId, student.id);

    expect(room.courseTitle).toBe('คอร์สห้องเรียน');
    expect(room.instructorName).toBe('ครูทดสอบ');
    expect(room.lessons).toHaveLength(4);
    expect(room.lessons.map((lesson) => lesson.orderIndex)).toEqual([1, 2, 3, 4]);
    expect(room.completedLessonCount).toBe(0);
    expect(room.progressPercent).toBe(0);
    expect(room.resumeLessonId).toBe(lessonIds[0]);
    expect(room.totalDurationSec).toBe(2400);
  });

  it('resumes at the first lesson that is still unfinished', async () => {
    await learn.complete(lessonIds[0], student.id);
    await learn.complete(lessonIds[1], student.id);

    const room = await learn.getRoom(courseId, student.id);

    expect(room.resumeLessonId).toBe(lessonIds[2]);
    expect(room.completedLessonCount).toBe(2);
    expect(room.progressPercent).toBe(50);
  });

  it('reports 100% once every lesson is complete', async () => {
    for (const lessonId of lessonIds) {
      await learn.complete(lessonId, student.id);
    }

    const room = await learn.getRoom(courseId, student.id);

    expect(room.completedLessonCount).toBe(4);
    expect(room.progressPercent).toBe(100);
    // Nothing left unfinished, so "continue" goes back to the beginning.
    expect(room.resumeLessonId).toBe(lessonIds[0]);
  });

  it('refuses the classroom to somebody who has not bought the course', async () => {
    const outsider = await createUser(prisma, { role: 'STUDENT' });

    await expect(learn.getRoom(courseId, outsider.id)).rejects.toMatchObject({
      code: 'NOT_ENROLLED',
    });
  });

  it('refuses the classroom to the instructor who wrote the course', async () => {
    // Owning it is not the same as being enrolled: there is no Enrollment row
    // to hang their progress on.
    await expect(learn.getRoom(courseId, instructor.id)).rejects.toMatchObject({
      code: 'NOT_ENROLLED',
    });
  });

  it('answers 404 for a course that does not exist', async () => {
    await expect(learn.getRoom('does-not-exist', student.id)).rejects.toMatchObject({
      code: 'COURSE_NOT_FOUND',
    });
  });

  // --- one lesson ----------------------------------------------------------

  it('hands the player a stream route, never a signed URL for the video', async () => {
    const lesson = await learn.getLesson(courseId, lessonIds[1], student.id);

    expect(lesson.videoStreamUrl).toBe(`/lessons/${lessonIds[1]}/stream`);
    // The object key must not travel, in any field, under any name
    // (CLAUDE.md, ข้อห้าม 10).
    expect(JSON.stringify(lesson)).not.toContain('video/');
  });

  it('signs attachments, which are meant to be downloadable', async () => {
    await createMaterial(prisma, {
      lessonId: lessonIds[0],
      fileKey: 'material/owner/handout.pdf',
      fileName: 'ใบงาน.pdf',
    });

    const lesson = await learn.getLesson(courseId, lessonIds[0], student.id);

    expect(lesson.materials).toHaveLength(1);
    expect(lesson.materials[0]?.fileName).toBe('ใบงาน.pdf');
    expect(lesson.materials[0]?.downloadUrl).toContain('material/owner/handout.pdf');
  });

  it('links each lesson to its neighbours', async () => {
    const first = await learn.getLesson(courseId, lessonIds[0], student.id);
    const middle = await learn.getLesson(courseId, lessonIds[1], student.id);
    const last = await learn.getLesson(courseId, lessonIds[3], student.id);

    expect(first.prevLessonId).toBeNull();
    expect(first.nextLessonId).toBe(lessonIds[1]);
    expect(middle.prevLessonId).toBe(lessonIds[0]);
    expect(middle.nextLessonId).toBe(lessonIds[2]);
    expect(last.nextLessonId).toBeNull();
  });

  it('refuses a lesson id that belongs to a different course', async () => {
    const categoryId = await createCategory(prisma);
    const otherCourseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '0.00',
    });
    const foreignLessonId = await createLesson(prisma, {
      courseId: otherCourseId,
      orderIndex: 1,
    });

    await expect(learn.getLesson(courseId, foreignLessonId, student.id)).rejects.toMatchObject({
      code: 'LESSON_NOT_IN_COURSE',
    });
  });

  it('summarises the quiz standing beside the lesson that holds it', async () => {
    const quizId = await createQuiz(prisma, {
      lessonId: lessonIds[0],
      questions: 4,
      passScore: 70,
    });
    await prisma.quizAttempt.createMany({
      data: [
        { quizId, studentId: student.id, score: 50, passed: false },
        { quizId, studentId: student.id, score: 75, passed: true },
      ],
    });

    const lesson = await learn.getLesson(courseId, lessonIds[0], student.id);

    expect(lesson.quiz?.questionCount).toBe(4);
    // The best attempt is what counts, not the latest one.
    expect(lesson.quiz?.bestScore).toBe(75);
    expect(lesson.quiz?.hasPassed).toBe(true);
    expect(lesson.quiz?.attemptCount).toBe(2);
  });

  it("does not leak another student's quiz score", async () => {
    const other = await createUser(prisma, { role: 'STUDENT' });
    await enrol(prisma, { courseId, studentId: other.id });

    const quizId = await createQuiz(prisma, { lessonId: lessonIds[0], questions: 2 });
    await prisma.quizAttempt.create({
      data: { quizId, studentId: other.id, score: 100, passed: true },
    });

    const lesson = await learn.getLesson(courseId, lessonIds[0], student.id);

    expect(lesson.quiz?.bestScore).toBeNull();
    expect(lesson.quiz?.attemptCount).toBe(0);
  });

  // --- progress ------------------------------------------------------------

  it('remembers where the video was left, so it resumes there next time', async () => {
    await learn.savePosition(lessonIds[0], student.id, 137);

    const lesson = await learn.getLesson(courseId, lessonIds[0], student.id);

    expect(lesson.progress.lastPositionSec).toBe(137);
    expect(lesson.progress.isCompleted).toBe(false);
  });

  it('counts a position as a bookmark, not as progress', async () => {
    await learn.savePosition(lessonIds[0], student.id, 590);

    const room = await learn.getRoom(courseId, student.id);

    expect(room.completedLessonCount).toBe(0);
    expect(room.progressPercent).toBe(0);
  });

  it('keeps the original completion time when a lesson is finished twice', async () => {
    const first = await learn.complete(lessonIds[0], student.id);
    const second = await learn.complete(lessonIds[0], student.id);

    expect(second.progress.completedAt).toBe(first.progress.completedAt);
    expect(second.course.completedLessonCount).toBe(1);
  });

  it('does not un-finish a lesson that gets rewound', async () => {
    await learn.complete(lessonIds[0], student.id);
    const rewound = await learn.savePosition(lessonIds[0], student.id, 10);

    expect(rewound.progress.isCompleted).toBe(true);
    expect(rewound.progress.lastPositionSec).toBe(10);
  });

  it('returns the recomputed course progress with every save', async () => {
    const result = await learn.complete(lessonIds[0], student.id);

    expect(result.course).toEqual({
      lessonCount: 4,
      completedLessonCount: 1,
      progressPercent: 25,
    });
  });

  it('refuses to record progress for somebody who has not bought the course', async () => {
    const outsider = await createUser(prisma, { role: 'STUDENT' });

    await expect(learn.savePosition(lessonIds[0], outsider.id, 30)).rejects.toMatchObject({
      code: 'NOT_ENROLLED',
    });
    await expect(learn.complete(lessonIds[0], outsider.id)).rejects.toMatchObject({
      code: 'NOT_ENROLLED',
    });
  });

  it("keeps two students' progress apart", async () => {
    const other = await createUser(prisma, { role: 'STUDENT' });
    await enrol(prisma, { courseId, studentId: other.id });

    await learn.complete(lessonIds[0], student.id);
    await learn.complete(lessonIds[1], other.id);
    await learn.complete(lessonIds[2], other.id);

    expect((await learn.getRoom(courseId, student.id)).completedLessonCount).toBe(1);
    expect((await learn.getRoom(courseId, other.id)).completedLessonCount).toBe(2);
  });
});
