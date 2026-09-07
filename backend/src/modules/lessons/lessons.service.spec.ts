import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CourseStatus } from '@prisma/client';
import {
  CourseStorageLimitExceededException,
  LessonAccessDeniedException,
  LessonHasNoVideoException,
  LessonOrderMismatchException,
  NotCourseOwnerException,
  RangeNotSatisfiableException,
} from '@/common/exceptions/catalog.exceptions';
import { PrismaService } from '@/infra/prisma.service';
import { CourseAccessService } from '@/modules/courses/course-access.service';
import { COURSE_MAX_STORAGE_BYTES } from '@getownly/shared';
import { FileNotFoundException } from '@/modules/uploads/uploads.errors';
import { LessonsService, parseRangeHeader } from './lessons.service';
import {
  asAuthUser,
  createCategory,
  createCourse,
  createLesson,
  createUser,
  enrol,
  resetDatabase,
  type TestUser,
} from '../../../test/factories';
import { FakeStorage } from '../../../test/fake-storage';

describe('LessonsService', () => {
  let prisma: PrismaService;
  let storage: FakeStorage;
  let lessons: LessonsService;

  let owner: TestUser;
  let otherInstructor: TestUser;
  let student: TestUser;
  let buyer: TestUser;
  let admin: TestUser;
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
    storage = new FakeStorage();
    lessons = new LessonsService(prisma, storage.asService(), new CourseAccessService(prisma));

    owner = await createUser(prisma, { role: 'INSTRUCTOR' });
    otherInstructor = await createUser(prisma, { role: 'INSTRUCTOR' });
    student = await createUser(prisma, { role: 'STUDENT' });
    buyer = await createUser(prisma, { role: 'STUDENT' });
    admin = await createUser(prisma, { role: 'ADMIN' });

    const categoryId = await createCategory(prisma);
    courseId = await createCourse(prisma, {
      instructorId: owner.id,
      categoryId,
      price: '990.00',
      status: CourseStatus.PUBLISHED,
    });
    await enrol(prisma, { courseId, studentId: buyer.id });
  });

  // -------------------------------------------------------------------------
  // Ordering
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('appends each new lesson after the last one', async () => {
      const first = await lessons.create(courseId, asAuthUser(owner), { title: 'บทที่หนึ่ง' });
      const second = await lessons.create(courseId, asAuthUser(owner), { title: 'บทที่สอง' });

      expect(first.orderIndex).toBe(1);
      expect(second.orderIndex).toBe(2);
    });

    it('refuses a lesson from someone who does not own the course', async () => {
      await expect(
        lessons.create(courseId, asAuthUser(otherInstructor), { title: 'บทเรียนแทรก' }),
      ).rejects.toBeInstanceOf(NotCourseOwnerException);

      expect(await prisma.lesson.count({ where: { courseId } })).toBe(0);
    });
  });

  describe('reorder', () => {
    it('rewrites the order without tripping the unique index', async () => {
      const a = await createLesson(prisma, { courseId, orderIndex: 1, title: 'ก' });
      const b = await createLesson(prisma, { courseId, orderIndex: 2, title: 'ข' });
      const c = await createLesson(prisma, { courseId, orderIndex: 3, title: 'ค' });

      const result = await lessons.reorder(courseId, asAuthUser(owner), {
        lessonIds: [c, a, b],
      });

      expect(result.map((lesson) => lesson.id)).toEqual([c, a, b]);
      expect(result.map((lesson) => lesson.orderIndex)).toEqual([1, 2, 3]);
    });

    it('rejects a payload that is not exactly the course`s lessons', async () => {
      const a = await createLesson(prisma, { courseId, orderIndex: 1 });
      const b = await createLesson(prisma, { courseId, orderIndex: 2 });

      // Missing one.
      await expect(
        lessons.reorder(courseId, asAuthUser(owner), { lessonIds: [a] }),
      ).rejects.toBeInstanceOf(LessonOrderMismatchException);

      // Duplicated.
      await expect(
        lessons.reorder(courseId, asAuthUser(owner), { lessonIds: [a, a] }),
      ).rejects.toBeInstanceOf(LessonOrderMismatchException);

      // A lesson from somewhere else.
      await expect(
        lessons.reorder(courseId, asAuthUser(owner), { lessonIds: [a, 'not-a-real-id'] }),
      ).rejects.toBeInstanceOf(LessonOrderMismatchException);

      // The original order survived every rejection.
      const untouched = await prisma.lesson.findMany({
        where: { courseId },
        orderBy: { orderIndex: 'asc' },
        select: { id: true },
      });
      expect(untouched.map((lesson) => lesson.id)).toEqual([a, b]);
    });
  });

  describe('remove', () => {
    it('closes the gap in the ordering and deletes the video', async () => {
      await createLesson(prisma, { courseId, orderIndex: 1 });
      const middle = await createLesson(prisma, {
        courseId,
        orderIndex: 2,
        videoKey: 'video/o/middle.mp4',
      });
      await createLesson(prisma, { courseId, orderIndex: 3 });

      await lessons.remove(middle, asAuthUser(owner));

      const remaining = await prisma.lesson.findMany({
        where: { courseId },
        orderBy: { orderIndex: 'asc' },
        select: { orderIndex: true },
      });
      expect(remaining.map((lesson) => lesson.orderIndex)).toEqual([1, 2]);
      expect(storage.removed).toContain('video/o/middle.mp4');
    });

    it('refuses to delete a lesson someone has already started watching', async () => {
      const lessonId = await createLesson(prisma, { courseId, orderIndex: 1 });
      const enrollment = await prisma.enrollment.findFirstOrThrow({
        where: { courseId, studentId: buyer.id },
        select: { id: true },
      });
      await prisma.lessonProgress.create({
        data: { enrollmentId: enrollment.id, lessonId, lastPositionSec: 42 },
      });

      await expect(lessons.remove(lessonId, asAuthUser(owner))).rejects.toBeInstanceOf(
        LessonAccessDeniedException,
      );
      expect(await prisma.lesson.count({ where: { id: lessonId } })).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Streaming access
  // -------------------------------------------------------------------------

  describe('openVideo', () => {
    const VIDEO_KEY = 'video/owner/lesson.mp4';

    async function createVideoLesson(isPreview: boolean): Promise<string> {
      const lessonId = await createLesson(prisma, {
        courseId,
        orderIndex: 1,
        videoKey: VIDEO_KEY,
        isPreview,
      });
      storage.put(VIDEO_KEY, Buffer.alloc(1000, 7), 'video/mp4');
      return lessonId;
    }

    it('refuses a signed-in visitor who has not bought the course', async () => {
      const lessonId = await createVideoLesson(false);

      await expect(
        lessons.openVideo(lessonId, asAuthUser(student), undefined),
      ).rejects.toBeInstanceOf(LessonAccessDeniedException);
    });

    it('lets the buyer, the owner and an admin through', async () => {
      const lessonId = await createVideoLesson(false);

      for (const user of [buyer, owner, admin]) {
        const slice = await lessons.openVideo(lessonId, asAuthUser(user), undefined);
        expect(slice.totalBytes).toBe(1000);
      }
    });

    it('lets anyone signed in watch a preview lesson', async () => {
      const lessonId = await createVideoLesson(true);

      const slice = await lessons.openVideo(lessonId, asAuthUser(student), undefined);

      expect(slice.isPartial).toBe(false);
      expect(slice.mimeType).toBe('video/mp4');
    });

    it('serves the requested byte window so seeking works', async () => {
      const lessonId = await createVideoLesson(true);

      const slice = await lessons.openVideo(lessonId, asAuthUser(buyer), 'bytes=200-499');

      expect(slice.isPartial).toBe(true);
      expect(slice.start).toBe(200);
      expect(slice.end).toBe(499);
      expect(slice.totalBytes).toBe(1000);
    });

    it('rejects a range that starts past the end of the file', async () => {
      const lessonId = await createVideoLesson(true);

      await expect(
        lessons.openVideo(lessonId, asAuthUser(buyer), 'bytes=5000-6000'),
      ).rejects.toBeInstanceOf(RangeNotSatisfiableException);
    });

    it('reports a lesson whose video was never uploaded', async () => {
      const lessonId = await createLesson(prisma, { courseId, orderIndex: 1, videoKey: null });

      await expect(
        lessons.openVideo(lessonId, asAuthUser(owner), undefined),
      ).rejects.toBeInstanceOf(LessonHasNoVideoException);
    });
  });

  // -------------------------------------------------------------------------
  // Scope 2.3.2: the 3 GB course storage cap
  // -------------------------------------------------------------------------

  describe('video storage tracking', () => {
    async function courseStorageUsed(): Promise<bigint> {
      const course = await prisma.course.findUniqueOrThrow({
        where: { id: courseId },
        select: { storageUsedBytes: true },
      });
      return course.storageUsedBytes;
    }

    it('adds the video size onto the course total when a lesson is created', async () => {
      const videoKey = `video/${owner.id}/lesson.mp4`;
      storage.put(videoKey, Buffer.alloc(10 * 1024 * 1024), 'video/mp4');

      await lessons.create(courseId, asAuthUser(owner), { title: 'บทใหม่', videoKey });

      expect(await courseStorageUsed()).toBe(10n * 1024n * 1024n);
    });

    it('refuses a lesson video that would push the course over 3 GB', async () => {
      await prisma.course.update({
        where: { id: courseId },
        data: { storageUsedBytes: BigInt(COURSE_MAX_STORAGE_BYTES) - 1024n },
      });
      const videoKey = `video/${owner.id}/too-big.mp4`;
      storage.put(videoKey, Buffer.alloc(2048), 'video/mp4');

      await expect(
        lessons.create(courseId, asAuthUser(owner), { title: 'บทใหม่', videoKey }),
      ).rejects.toBeInstanceOf(CourseStorageLimitExceededException);
    });

    it('refuses a video key nothing was ever uploaded to', async () => {
      await expect(
        lessons.create(courseId, asAuthUser(owner), {
          title: 'บทใหม่',
          videoKey: `video/${owner.id}/ghost.mp4`,
        }),
      ).rejects.toBeInstanceOf(FileNotFoundException);
    });

    it('adjusts the total by the difference when a video is replaced', async () => {
      const firstKey = `video/${owner.id}/first.mp4`;
      storage.put(firstKey, Buffer.alloc(10 * 1024 * 1024), 'video/mp4');
      const lesson = await lessons.create(courseId, asAuthUser(owner), {
        title: 'บทใหม่',
        videoKey: firstKey,
      });
      expect(await courseStorageUsed()).toBe(10n * 1024n * 1024n);

      const secondKey = `video/${owner.id}/second.mp4`;
      storage.put(secondKey, Buffer.alloc(4 * 1024 * 1024), 'video/mp4');
      await lessons.update(lesson.id, asAuthUser(owner), { videoKey: secondKey });

      // Replaced a 10MB video with a 4MB one: the total drops, it does not add.
      expect(await courseStorageUsed()).toBe(4n * 1024n * 1024n);
      expect(storage.removed).toContain(firstKey);
    });

    it('frees the video and every material size when a lesson is deleted', async () => {
      const videoKey = `video/${owner.id}/lesson.mp4`;
      storage.put(videoKey, Buffer.alloc(5 * 1024 * 1024), 'video/mp4');
      const lesson = await lessons.create(courseId, asAuthUser(owner), {
        title: 'บทใหม่',
        videoKey,
      });
      await prisma.material.create({
        data: {
          lessonId: lesson.id,
          fileName: 'เอกสาร.pdf',
          fileKey: `material/${owner.id}/doc.pdf`,
          fileSize: 1024 * 1024,
          mimeType: 'application/pdf',
        },
      });
      // Created the material directly rather than through MaterialsService,
      // so mirror what that service would have added onto the running total.
      await prisma.course.update({
        where: { id: courseId },
        data: { storageUsedBytes: { increment: 1024 * 1024 } },
      });
      expect(await courseStorageUsed()).toBe(6n * 1024n * 1024n);

      await lessons.remove(lesson.id, asAuthUser(owner));

      expect(await courseStorageUsed()).toBe(0n);
    });
  });
});

// ---------------------------------------------------------------------------
// Range parsing, tested on its own because every seek depends on it
// ---------------------------------------------------------------------------

describe('parseRangeHeader', () => {
  const SIZE = 10_000;

  it('returns null when the client did not ask for a range', () => {
    expect(parseRangeHeader(undefined, SIZE)).toBeNull();
    expect(parseRangeHeader('items=0-1', SIZE)).toBeNull();
  });

  it('reads an explicit window', () => {
    expect(parseRangeHeader('bytes=100-199', SIZE)).toEqual({ start: 100, end: 199 });
  });

  it('clamps an end past the last byte', () => {
    expect(parseRangeHeader('bytes=9990-99999', SIZE)).toEqual({ start: 9990, end: 9999 });
  });

  it('reads a suffix range as the last N bytes', () => {
    expect(parseRangeHeader('bytes=-500', SIZE)).toEqual({ start: 9500, end: 9999 });
  });

  it('caps an open-ended range instead of promising the whole file', () => {
    const parsed = parseRangeHeader('bytes=0-', 500 * 1024 * 1024);

    expect(parsed).not.toBe('invalid');
    expect(parsed).not.toBeNull();
    if (parsed && parsed !== 'invalid') {
      expect(parsed.end - parsed.start + 1).toBe(8 * 1024 * 1024);
    }
  });

  it('calls out ranges that cannot be satisfied', () => {
    expect(parseRangeHeader('bytes=10000-', SIZE)).toBe('invalid');
    expect(parseRangeHeader('bytes=-0', SIZE)).toBe('invalid');
    expect(parseRangeHeader('bytes=-', SIZE)).toBe('invalid');
    expect(parseRangeHeader('bytes=500-100', SIZE)).toBe('invalid');
  });
});
