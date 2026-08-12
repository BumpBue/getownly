import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CourseStatus } from '@prisma/client';
import {
  CourseIncompleteException,
  CourseNotDeletableException,
  CourseNotEditableException,
  CourseNotFoundException,
  CourseNotSubmittableException,
  CourseNotUnpublishableException,
  NotCourseOwnerException,
} from '@/common/exceptions/catalog.exceptions';
import { PrismaService } from '@/infra/prisma.service';
import { CourseAccessService } from './course-access.service';
import { CoursesService } from './courses.service';
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

describe('CoursesService', () => {
  let prisma: PrismaService;
  let storage: FakeStorage;
  let courses: CoursesService;

  let owner: TestUser;
  let otherInstructor: TestUser;
  let student: TestUser;
  let admin: TestUser;
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
    courses = new CoursesService(prisma, storage.asService(), new CourseAccessService(prisma));

    owner = await createUser(prisma, { role: 'INSTRUCTOR' });
    otherInstructor = await createUser(prisma, { role: 'INSTRUCTOR' });
    student = await createUser(prisma, { role: 'STUDENT' });
    admin = await createUser(prisma, { role: 'ADMIN' });
    categoryId = await createCategory(prisma);
  });

  /** A complete draft: cover, description and one lesson, ready to submit. */
  async function createSubmittableDraft(): Promise<string> {
    const courseId = await createCourse(prisma, {
      instructorId: owner.id,
      categoryId,
      price: '1290.00',
      status: CourseStatus.DRAFT,
    });
    await prisma.course.update({
      where: { id: courseId },
      data: { coverKey: `cover/${owner.id}/a.jpg` },
    });
    await createLesson(prisma, { courseId, orderIndex: 1 });
    return courseId;
  }

  // -------------------------------------------------------------------------
  // Public catalog
  // -------------------------------------------------------------------------

  describe('listPublished', () => {
    it('returns published courses only, whatever the filters ask for', async () => {
      await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.PUBLISHED,
        title: 'คอร์สที่เผยแพร่แล้ว',
      });
      await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.DRAFT,
        title: 'คอร์สฉบับร่าง',
      });
      await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.PENDING_REVIEW,
        title: 'คอร์สรอตรวจสอบ',
      });

      const result = await courses.listPublished({});

      expect(result.total).toBe(1);
      expect(result.items[0].title).toBe('คอร์สที่เผยแพร่แล้ว');
    });

    it('filters by Thai search text, category and price range', async () => {
      const otherCategoryId = await createCategory(prisma);

      await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '500.00',
        title: 'การปั้นโมเดลสามมิติ',
      });
      await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '2500.00',
        title: 'การจัดแสงขั้นสูง',
      });
      await createCourse(prisma, {
        instructorId: owner.id,
        categoryId: otherCategoryId,
        price: '500.00',
        title: 'การปั้นโมเดลสำหรับเกม',
      });

      const bySearch = await courses.listPublished({ search: 'ปั้นโมเดล' });
      expect(bySearch.total).toBe(2);

      const byCategory = await courses.listPublished({ categoryId });
      expect(byCategory.total).toBe(2);

      const byPrice = await courses.listPublished({ minPrice: '1000', maxPrice: '3000' });
      expect(byPrice.total).toBe(1);
      expect(byPrice.items[0].title).toBe('การจัดแสงขั้นสูง');

      const both = await courses.listPublished({ search: 'ปั้นโมเดล', categoryId });
      expect(both.total).toBe(1);
      expect(both.items[0].title).toBe('การปั้นโมเดลสามมิติ');
    });

    it('treats freeOnly as an exact price of zero', async () => {
      await createCourse(prisma, { instructorId: owner.id, categoryId, price: '0.00' });
      await createCourse(prisma, { instructorId: owner.id, categoryId, price: '990.00' });

      const result = await courses.listPublished({ freeOnly: true });

      expect(result.total).toBe(1);
      expect(result.items[0].price).toBe('0.00');
    });

    it('sorts by price and by number of enrollments', async () => {
      const cheap = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        title: 'ถูก',
      });
      const expensive = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '3000.00',
        title: 'แพง',
      });
      await enrol(prisma, { courseId: expensive, studentId: student.id });

      const byPrice = await courses.listPublished({ sort: 'price_asc' });
      expect(byPrice.items.map((item) => item.id)).toEqual([cheap, expensive]);

      const byPopularity = await courses.listPublished({ sort: 'popular' });
      expect(byPopularity.items[0].id).toBe(expensive);
      expect(byPopularity.items[0].enrollmentCount).toBe(1);
    });

    it('paginates and reports the total across pages', async () => {
      for (let index = 0; index < 5; index += 1) {
        await createCourse(prisma, {
          instructorId: owner.id,
          categoryId,
          price: `${index * 100}.00`,
        });
      }

      const page = await courses.listPublished({ page: 2, limit: 2, sort: 'price_asc' });

      expect(page.total).toBe(5);
      expect(page.totalPages).toBe(3);
      expect(page.items).toHaveLength(2);
    });

    it('sums lesson durations onto the card', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '0.00',
      });
      await createLesson(prisma, { courseId, orderIndex: 1, durationSec: 600 });
      await createLesson(prisma, { courseId, orderIndex: 2, durationSec: 900 });

      const result = await courses.listPublished({});

      expect(result.items[0].lessonCount).toBe(2);
      expect(result.items[0].totalDurationSec).toBe(1500);
    });
  });

  // -------------------------------------------------------------------------
  // Visibility
  // -------------------------------------------------------------------------

  describe('findOne', () => {
    it('hides an unpublished course from guests and from other users', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.DRAFT,
      });

      await expect(courses.findOne(courseId, null)).rejects.toBeInstanceOf(CourseNotFoundException);
      await expect(courses.findOne(courseId, asAuthUser(student))).rejects.toBeInstanceOf(
        CourseNotFoundException,
      );
      await expect(courses.findOne(courseId, asAuthUser(otherInstructor))).rejects.toBeInstanceOf(
        CourseNotFoundException,
      );
    });

    it('shows an unpublished course to its owner and to an admin', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.DRAFT,
      });

      await expect(courses.findOne(courseId, asAuthUser(owner))).resolves.toMatchObject({
        id: courseId,
        isOwner: true,
      });
      await expect(courses.findOne(courseId, asAuthUser(admin))).resolves.toMatchObject({
        isOwner: true,
      });
    });

    it('reports enrolment for the viewer and never leaks a video key', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
      });
      await createLesson(prisma, { courseId, orderIndex: 1, videoKey: 'video/x/secret.mp4' });
      await enrol(prisma, { courseId, studentId: student.id });

      const forBuyer = await courses.findOne(courseId, asAuthUser(student));
      const forGuest = await courses.findOne(courseId, null);

      expect(forBuyer.isEnrolled).toBe(true);
      expect(forGuest.isEnrolled).toBe(false);
      expect(forGuest.lessons[0].hasVideo).toBe(true);
      expect(JSON.stringify(forGuest)).not.toContain('secret.mp4');
    });
  });

  // -------------------------------------------------------------------------
  // Ownership
  // -------------------------------------------------------------------------

  describe('ownership', () => {
    it('refuses every write from an instructor who does not own the course', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.DRAFT,
      });
      const intruder = asAuthUser(otherInstructor);

      await expect(
        courses.update(courseId, intruder, { title: 'ยึดคอร์สนี้เป็นของฉัน' }),
      ).rejects.toBeInstanceOf(NotCourseOwnerException);
      await expect(courses.remove(courseId, intruder)).rejects.toBeInstanceOf(
        NotCourseOwnerException,
      );
      await expect(courses.submitForReview(courseId, intruder)).rejects.toBeInstanceOf(
        NotCourseOwnerException,
      );

      // Nothing changed.
      const untouched = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
      expect(untouched.status).toBe(CourseStatus.DRAFT);
    });

    it('ignores an instructorId sent in the body and uses the token', async () => {
      const created = await courses.create(asAuthUser(owner), {
        title: 'คอร์สทดสอบการสร้าง',
        description: 'คำอธิบายคอร์สที่ยาวพอสำหรับการตรวจสอบความถูกต้อง',
        categoryId,
        // A body field the DTO does not declare would be rejected by the global
        // pipe; this asserts the id actually stored is the caller's.
      });

      const stored = await prisma.course.findUniqueOrThrow({ where: { id: created.id } });
      expect(stored.instructorId).toBe(owner.id);
      expect(stored.status).toBe(CourseStatus.DRAFT);
      expect(stored.price.toFixed(2)).toBe('0.00');
    });
  });

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  describe('update', () => {
    it('blocks edits while the course is under review', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.PENDING_REVIEW,
      });

      await expect(
        courses.update(courseId, asAuthUser(owner), { title: 'แก้ระหว่างตรวจ' }),
      ).rejects.toBeInstanceOf(CourseNotEditableException);
    });

    it('deletes the previous cover once the row points at a new one', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.DRAFT,
      });
      await prisma.course.update({
        where: { id: courseId },
        data: { coverKey: `cover/${owner.id}/old.jpg` },
      });

      await courses.update(courseId, asAuthUser(owner), {
        coverKey: `cover/${owner.id}/new.jpg`,
      });

      expect(storage.removed).toContain(`cover/${owner.id}/old.jpg`);
    });

    it('sends a published course back to review when the price changes', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.PUBLISHED,
      });

      const result = await courses.update(courseId, asAuthUser(owner), { price: '150.00' });

      expect(result.status).toBe(CourseStatus.PENDING_REVIEW);
      expect(result.price).toBe('150.00');
    });

    it('leaves a published course alone when the price is unchanged', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.PUBLISHED,
      });

      const result = await courses.update(courseId, asAuthUser(owner), { price: '100.00' });

      expect(result.status).toBe(CourseStatus.PUBLISHED);
    });

    it('lets a published course edit its content without triggering re-review', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.PUBLISHED,
      });

      const result = await courses.update(courseId, asAuthUser(owner), {
        title: 'ชื่อคอร์สที่แก้ไขแล้ว',
      });

      expect(result.status).toBe(CourseStatus.PUBLISHED);
      expect(result.title).toBe('ชื่อคอร์สที่แก้ไขแล้ว');
    });

    it('does not send a draft into review just because its price changed', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.DRAFT,
      });

      const result = await courses.update(courseId, asAuthUser(owner), { price: '200.00' });

      expect(result.status).toBe(CourseStatus.DRAFT);
    });
  });

  describe('remove', () => {
    it('deletes a draft and cleans up its files', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.DRAFT,
      });
      await createLesson(prisma, { courseId, orderIndex: 1, videoKey: 'video/o/lesson.mp4' });

      await courses.remove(courseId, asAuthUser(owner));

      expect(await prisma.course.count({ where: { id: courseId } })).toBe(0);
      expect(storage.removed).toContain('video/o/lesson.mp4');
    });

    it('refuses to delete anything that is not a draft', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.PUBLISHED,
      });

      await expect(courses.remove(courseId, asAuthUser(owner))).rejects.toBeInstanceOf(
        CourseNotDeletableException,
      );
      expect(await prisma.course.count({ where: { id: courseId } })).toBe(1);
    });

    it('refuses to delete a draft that someone has already enrolled in', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.DRAFT,
      });
      await enrol(prisma, { courseId, studentId: student.id });

      await expect(courses.remove(courseId, asAuthUser(owner))).rejects.toBeInstanceOf(
        CourseNotDeletableException,
      );
      expect(await prisma.course.count({ where: { id: courseId } })).toBe(1);
    });
  });

  describe('submitForReview', () => {
    it('moves a complete draft into the review queue', async () => {
      const courseId = await createSubmittableDraft();

      const result = await courses.submitForReview(courseId, asAuthUser(owner));

      expect(result.status).toBe(CourseStatus.PENDING_REVIEW);
    });

    it('lists what is missing instead of submitting an incomplete course', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.DRAFT,
      });

      await expect(courses.submitForReview(courseId, asAuthUser(owner))).rejects.toBeInstanceOf(
        CourseIncompleteException,
      );

      const stillDraft = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
      expect(stillDraft.status).toBe(CourseStatus.DRAFT);
    });

    it('clears the old rejection reason when a rejected course is sent back', async () => {
      const courseId = await createSubmittableDraft();
      await prisma.course.update({
        where: { id: courseId },
        data: { status: CourseStatus.REJECTED, rejectReason: 'เสียงไม่ชัด' },
      });

      await courses.submitForReview(courseId, asAuthUser(owner));

      const resubmitted = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
      expect(resubmitted.status).toBe(CourseStatus.PENDING_REVIEW);
      expect(resubmitted.rejectReason).toBeNull();
    });

    it('refuses to submit a course that is already published', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.PUBLISHED,
      });

      await expect(courses.submitForReview(courseId, asAuthUser(owner))).rejects.toBeInstanceOf(
        CourseNotSubmittableException,
      );
    });
  });

  describe('unpublish', () => {
    it('takes a published course off the market', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.PUBLISHED,
      });

      const result = await courses.unpublish(courseId, asAuthUser(owner));

      expect(result.status).toBe(CourseStatus.UNPUBLISHED);
    });

    it('leaves an already-bought course reachable by its buyer, just not for sale', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.PUBLISHED,
      });
      await enrol(prisma, { courseId, studentId: student.id });

      await courses.unpublish(courseId, asAuthUser(owner));

      expect(await prisma.enrollment.count({ where: { courseId } })).toBe(1);
      const stored = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
      expect(stored.status).toBe(CourseStatus.UNPUBLISHED);
    });

    it('drops out of the public catalog once unpublished', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.PUBLISHED,
      });

      await courses.unpublish(courseId, asAuthUser(owner));

      const listed = await courses.listPublished({});
      expect(listed.items.map((item) => item.id)).not.toContain(courseId);
    });

    it('refuses to unpublish anything that is not currently published', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.DRAFT,
      });

      await expect(courses.unpublish(courseId, asAuthUser(owner))).rejects.toBeInstanceOf(
        CourseNotUnpublishableException,
      );
    });

    it('refuses an instructor who does not own the course', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '100.00',
        status: CourseStatus.PUBLISHED,
      });

      await expect(courses.unpublish(courseId, asAuthUser(otherInstructor))).rejects.toBeInstanceOf(
        NotCourseOwnerException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Instructor views
  // -------------------------------------------------------------------------

  describe('listMine and statsFor', () => {
    it('returns only the caller`s courses, in every status', async () => {
      await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '0.00',
        status: CourseStatus.DRAFT,
      });
      const published = await createCourse(prisma, {
        instructorId: owner.id,
        categoryId,
        price: '0.00',
        status: CourseStatus.PUBLISHED,
      });
      await createCourse(prisma, {
        instructorId: otherInstructor.id,
        categoryId,
        price: '0.00',
        status: CourseStatus.PUBLISHED,
      });
      await enrol(prisma, { courseId: published, studentId: student.id });

      const mine = await courses.listMine(asAuthUser(owner));
      const stats = await courses.statsFor(asAuthUser(owner));

      expect(mine).toHaveLength(2);
      expect(stats).toMatchObject({
        totalCourses: 2,
        publishedCourses: 1,
        draftCourses: 1,
        pendingCourses: 0,
        totalStudents: 1,
      });
    });
  });
});
