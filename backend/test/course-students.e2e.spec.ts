import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Role } from '@prisma/client';
import { ACCESS_TOKEN_COOKIE } from '@/common/cookies';
import { PrismaService } from '@/infra/prisma.service';
import { createHarness, cookieHeader, cookiesFrom, type Harness } from './app-harness';
import { createCategory, createCourse, createLesson, enrol, resetDatabase } from './factories';

/**
 * ทก.01 A9 over real HTTP.
 *
 * The service tests prove the numbers. Only a request proves the gate: an
 * instructor may read the roster of a course they own and of no other, and a
 * student may not read one at all.
 */
describe('Course students (e2e)', () => {
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
    const handle = `roster${sequence}`;

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

  function rosterOf(courseId: string, cookie?: string): request.Test {
    const call = request(harness.server).get(`/api/instructor/courses/${courseId}/students`);
    return cookie ? call.set('Cookie', cookie) : call;
  }

  it('lets an instructor read the roster of their own course', async () => {
    const instructor = await signUp(Role.INSTRUCTOR);
    const student = await signUp(Role.STUDENT);

    const courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '500.00',
    });
    await createLesson(prisma, { courseId, orderIndex: 1 });
    await enrol(prisma, { courseId, studentId: student.id });

    const response = await rosterOf(courseId, instructor.cookie).expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.items[0]).toMatchObject({
      studentId: student.id,
      progressPercent: 0,
      lessonCount: 1,
      passedQuizCount: 0,
    });
    // ทก.01 grants "see who is enrolled", not "contact them".
    expect(JSON.stringify(response.body)).not.toContain('@test.local');
  });

  it('(จ) refuses an instructor asking about another instructor course', async () => {
    const mine = await signUp(Role.INSTRUCTOR);
    const theirs = await signUp(Role.INSTRUCTOR);
    const student = await signUp(Role.STUDENT);

    const theirCourseId = await createCourse(prisma, {
      instructorId: theirs.id,
      categoryId,
      price: '500.00',
    });
    await enrol(prisma, { courseId: theirCourseId, studentId: student.id });

    const response = await rosterOf(theirCourseId, mine.cookie).expect(403);
    expect(response.body.code).toBe('NOT_COURSE_OWNER');
  });

  it('(ฉ) refuses a student, and refuses a caller with no session', async () => {
    const instructor = await signUp(Role.INSTRUCTOR);
    const student = await signUp(Role.STUDENT);

    const courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '500.00',
    });

    await rosterOf(courseId, student.cookie).expect(403);
    await rosterOf(courseId).expect(401);
  });

  it('answers 404 for a course id that does not exist', async () => {
    const instructor = await signUp(Role.INSTRUCTOR);

    const response = await rosterOf('cl00000000000000000000000', instructor.cookie).expect(404);
    expect(response.body.code).toBe('COURSE_NOT_FOUND');
  });

  it('(ช) pages over HTTP the same way the service does', async () => {
    const instructor = await signUp(Role.INSTRUCTOR);
    const courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '0.00',
    });

    for (let index = 0; index < 25; index += 1) {
      const student = await signUp(Role.STUDENT);
      await enrol(prisma, { courseId, studentId: student.id });
    }

    const first = await rosterOf(courseId, instructor.cookie).expect(200);
    const second = await rosterOf(courseId, instructor.cookie).query({ page: 2 }).expect(200);

    expect(first.body.items).toHaveLength(20);
    expect(second.body.items).toHaveLength(5);
    expect(first.body.totalPages).toBe(2);

    const ids = [...first.body.items, ...second.body.items].map(
      (item: { enrollmentId: string }) => item.enrollmentId,
    );
    expect(new Set(ids).size).toBe(25);
  });
});
