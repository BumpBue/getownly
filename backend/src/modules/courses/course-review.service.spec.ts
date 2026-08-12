import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/infra/prisma.service';
import { CategoriesService } from '@/modules/categories/categories.service';
import { CourseReviewService } from './course-review.service';
import {
  createCategory,
  createCourse,
  createLesson,
  createUser,
  resetDatabase,
  type TestUser,
} from '../../../test/factories';
import { FakeStorage } from '../../../test/fake-storage';

describe('CourseReviewService', () => {
  let prisma: PrismaService;
  let storage: FakeStorage;
  let review: CourseReviewService;
  let categories: CategoriesService;

  let instructor: TestUser;
  let categoryId: string;

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
    review = new CourseReviewService(prisma, storage.asService());
    categories = new CategoriesService(prisma);

    instructor = await createUser(prisma, { role: 'INSTRUCTOR', displayName: 'ครูทดสอบ' });
    categoryId = await createCategory(prisma);
  });

  const submit = async (title?: string) => {
    const courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '1200.00',
      status: 'PENDING_REVIEW',
      title,
    });
    await createLesson(prisma, { courseId, orderIndex: 1, durationSec: 600 });
    await createLesson(prisma, { courseId, orderIndex: 2, videoKey: null });
    return courseId;
  };

  // --- the queue ------------------------------------------------------------

  it('queues only the courses actually waiting for a decision', async () => {
    await submit('คอร์สที่รอตรวจ');
    await createCourse(prisma, { instructorId: instructor.id, categoryId, price: '0.00' });
    await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '0.00',
      status: 'DRAFT',
    });

    const queue = await review.listPending({});

    expect(queue.total).toBe(1);
    expect(queue.items[0]?.title).toBe('คอร์สที่รอตรวจ');
  });

  it('shows the curriculum, so nothing is approved sight unseen', async () => {
    await submit();

    const [course] = (await review.listPending({})).items;

    expect(course?.lessonCount).toBe(2);
    // One of the two lessons has no video, which is exactly the sort of thing
    // this queue exists to catch.
    expect(course?.lessonsWithVideo).toBe(1);
    expect(course?.lessons).toHaveLength(2);
    expect(course?.instructor.displayName).toBe('ครูทดสอบ');
    // Never the object key itself (CLAUDE.md, ข้อห้าม 10).
    expect(JSON.stringify(course)).not.toContain('videoKey');
  });

  // --- deciding -------------------------------------------------------------

  it('publishes an approved course and stamps the date', async () => {
    const courseId = await submit();

    const approved = await review.approve(courseId);

    expect(approved.status).toBe('PUBLISHED');

    const stored = await prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      select: { status: true, publishedAt: true },
    });
    expect(stored.status).toBe('PUBLISHED');
    expect(stored.publishedAt).not.toBeNull();
  });

  it('clears an old rejection when the resubmission is approved', async () => {
    const courseId = await submit();
    await review.reject(courseId, 'วิดีโอบทที่ 2 ยังไม่ได้อัปโหลด กรุณาเพิ่มก่อนส่งใหม่');
    await prisma.course.update({
      where: { id: courseId },
      data: { status: 'PENDING_REVIEW' },
    });

    const approved = await review.approve(courseId);

    // Leaving the note behind would keep showing a complaint already answered.
    expect(approved.rejectReason).toBeNull();
  });

  it('records the reason with a rejection', async () => {
    const courseId = await submit();

    const rejected = await review.reject(courseId, 'เนื้อหายังไม่ครบตามที่อธิบายไว้ในหน้าคอร์ส');

    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectReason).toBe('เนื้อหายังไม่ครบตามที่อธิบายไว้ในหน้าคอร์ส');
  });

  it('refuses to decide twice, so two open queues cannot fight', async () => {
    const courseId = await submit();
    await review.approve(courseId);

    await expect(review.approve(courseId)).rejects.toMatchObject({
      code: 'COURSE_NOT_UNDER_REVIEW',
    });
    await expect(review.reject(courseId, 'เปลี่ยนใจแล้วขอปฏิเสธแทน')).rejects.toMatchObject({
      code: 'COURSE_NOT_UNDER_REVIEW',
    });
  });

  it('refuses to decide on a course that never asked', async () => {
    const draftId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '0.00',
      status: 'DRAFT',
    });

    await expect(review.approve(draftId)).rejects.toMatchObject({
      code: 'COURSE_NOT_UNDER_REVIEW',
    });
  });

  it('answers 404 for a course that does not exist', async () => {
    await expect(review.approve('does-not-exist')).rejects.toMatchObject({
      code: 'COURSE_NOT_FOUND',
    });
  });

  it('makes an approved course appear in the public catalog', async () => {
    const courseId = await submit('คอร์สที่เพิ่งอนุมัติ');

    const before = await prisma.course.count({ where: { status: 'PUBLISHED' } });
    await review.approve(courseId);
    const after = await prisma.course.count({ where: { status: 'PUBLISHED' } });

    expect(after).toBe(before + 1);
    // And its category now counts it, which is what the catalog sidebar shows.
    const [category] = await categories.listAll();
    expect(category?.courseCount).toBe(1);
  });
});
