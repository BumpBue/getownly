import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Role } from '@prisma/client';
import { ACCESS_TOKEN_COOKIE } from '@/common/cookies';
import { PrismaService } from '@/infra/prisma.service';
import { createHarness, cookieHeader, cookiesFrom, type Harness } from './app-harness';
import type { FakeStorage } from './fake-storage';
import { createCategory, createCourse, createLesson, enrol, resetDatabase } from './factories';

/** Enough bytes to prove which file came back, and small enough to compare. */
const VIDEO = Buffer.from('preview-video-bytes-0123456789', 'utf8');

/**
 * Free lesson previews, over real HTTP.
 *
 * The screen offering a preview is new; the rule behind it is not, and this is
 * the test that says so out loud. A preview lets somebody watch one lesson
 * before paying, and the danger of that feature is obvious: if the check were
 * ever loosened to "the course has a preview" rather than "this lesson is the
 * preview", the whole curriculum would be free to anyone with a login.
 */
describe('Lesson preview (e2e)', () => {
  let harness: Harness;
  let prisma: PrismaService;
  let storage: FakeStorage;

  let categoryId: string;
  let instructor: Account;
  let outsider: Account;
  let courseId: string;
  let previewLessonId: string;
  let lockedLessonId: string;
  let emptyPreviewLessonId: string;

  beforeAll(async () => {
    harness = await createHarness({ fakeStorage: true });
    prisma = harness.prisma;
    storage = harness.storage as FakeStorage;
  });

  afterAll(async () => {
    await harness.app.close();
  });

  interface Account {
    id: string;
    cookie: string;
  }

  let sequence = 0;

  async function signUp(role: Role): Promise<Account> {
    sequence += 1;
    const handle = `prev${sequence}`;

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

  beforeEach(async () => {
    await resetDatabase(prisma);
    harness.resetRateLimits();
    storage.clear();

    categoryId = await createCategory(prisma);
    instructor = await signUp(Role.INSTRUCTOR);
    outsider = await signUp(Role.STUDENT);

    courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '1500.00',
    });

    previewLessonId = await createLesson(prisma, {
      courseId,
      orderIndex: 1,
      isPreview: true,
      videoKey: 'video/owner/preview.mp4',
    });
    lockedLessonId = await createLesson(prisma, {
      courseId,
      orderIndex: 2,
      isPreview: false,
      videoKey: 'video/owner/locked.mp4',
    });
    // A preview the instructor has flagged but never uploaded a file for —
    // exactly the state every seeded demo course is in.
    emptyPreviewLessonId = await createLesson(prisma, {
      courseId,
      orderIndex: 3,
      isPreview: true,
      videoKey: 'video/owner/missing.mp4',
    });

    storage.put('video/owner/preview.mp4', VIDEO, 'video/mp4');
    storage.put('video/owner/locked.mp4', VIDEO, 'video/mp4');
  });

  const streamUrl = (lessonId: string) => `/api/lessons/${lessonId}/stream`;

  it('plays a preview lesson for somebody who has not bought the course', async () => {
    const response = await request(harness.server)
      .get(streamUrl(previewLessonId))
      .set('Cookie', outsider.cookie)
      .expect(200);

    expect(response.headers['content-type']).toContain('video/mp4');
    expect(Buffer.from(response.body).equals(VIDEO)).toBe(true);

    // Still not enrolled: watching a preview buys nothing.
    const enrolment = await prisma.enrollment.count({
      where: { courseId, studentId: outsider.id },
    });
    expect(enrolment).toBe(0);
  });

  it('serves a byte range of a preview, so the player can seek', async () => {
    const response = await request(harness.server)
      .get(streamUrl(previewLessonId))
      .set('Cookie', outsider.cookie)
      .set('Range', 'bytes=0-4')
      .expect(206);

    expect(response.headers['content-range']).toBe(`bytes 0-4/${VIDEO.length}`);
  });

  /**
   * The one that matters.
   *
   * A preview is one lesson, not a key to the course. Asked directly, with a
   * valid session and a real lesson id, the answer has to be no.
   */
  it('refuses a lesson that is not a preview, to the same person, in the same course', async () => {
    await request(harness.server)
      .get(streamUrl(previewLessonId))
      .set('Cookie', outsider.cookie)
      .expect(200);

    const refused = await request(harness.server)
      .get(streamUrl(lockedLessonId))
      .set('Cookie', outsider.cookie)
      .expect(403);

    expect(refused.body.code).toBe('LESSON_ACCESS_DENIED');
  });

  it('refuses a locked lesson however the request is dressed up', async () => {
    for (const range of [undefined, 'bytes=0-0', 'bytes=0-']) {
      const call = request(harness.server)
        .get(streamUrl(lockedLessonId))
        .set('Cookie', outsider.cookie);
      if (range) call.set('Range', range);

      const response = await call;
      expect(response.status).toBe(403);
      // Nothing of the file leaks in the refusal itself.
      expect(JSON.stringify(response.body)).not.toContain(VIDEO.toString('utf8'));
    }
  });

  it('opens the locked lesson once the course has actually been bought', async () => {
    await enrol(prisma, { courseId, studentId: outsider.id });

    await request(harness.server)
      .get(streamUrl(lockedLessonId))
      .set('Cookie', outsider.cookie)
      .expect(200);
  });

  it('asks a signed-out visitor to sign in rather than serving the preview', async () => {
    // 401, not 403: the visitor is not refused, they are unidentified — which
    // is why the page sends them to log in and back again.
    await request(harness.server).get(streamUrl(previewLessonId)).expect(401);
  });

  it('says the video is missing rather than failing blankly', async () => {
    const response = await request(harness.server)
      .get(streamUrl(emptyPreviewLessonId))
      .set('Cookie', outsider.cookie)
      .expect(404);

    // The dialog turns exactly this code into "ผู้สอนยังไม่ได้อัปโหลดวิดีโอ...".
    expect(response.body.code).toBe('LESSON_HAS_NO_VIDEO');
  });

  it('lets the instructor watch their own locked lesson', async () => {
    await request(harness.server)
      .get(streamUrl(lockedLessonId))
      .set('Cookie', instructor.cookie)
      .expect(200);
  });

  it('marks preview lessons on the public course page, and no others', async () => {
    const response = await request(harness.server).get(`/api/courses/${courseId}`).expect(200);

    const flags = response.body.lessons.map(
      (lesson: { id: string; isPreview: boolean }) => lesson.isPreview,
    );
    expect(flags).toEqual([true, false, true]);

    // The page decides what is clickable from this flag alone, so nothing in
    // the payload may hand out a way to reach the video directly.
    expect(JSON.stringify(response.body)).not.toContain('video/');
  });
});
