import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ContentReportStatus, ContentReportTargetType, CourseStatus } from '@prisma/client';
import { CourseNotFoundException } from '@/common/exceptions/catalog.exceptions';
import {
  ContentReportAlreadyReviewedException,
  ContentReportNotFoundException,
  CourseNotSuspendedException,
} from '@/common/exceptions/content-report.exceptions';
import {
  QnaAccessDeniedException,
  QnaThreadNotFoundException,
} from '@/common/exceptions/qna.exceptions';
import { PrismaService } from '@/infra/prisma.service';
import { CourseAccessService } from '@/modules/courses/course-access.service';
import { ContentReportsService } from './content-reports.service';
import {
  asAuthUser,
  createCategory,
  createCourse,
  createUser,
  enrol,
  resetDatabase,
  type TestUser,
} from '../../../test/factories';

describe('ContentReportsService', () => {
  let prisma: PrismaService;
  let reports: ContentReportsService;

  let student: TestUser;
  let otherStudent: TestUser;
  let instructor: TestUser;
  let admin: TestUser;
  let courseId: string;
  let threadId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    reports = new ContentReportsService(prisma, new CourseAccessService(prisma));

    student = await createUser(prisma, { role: 'STUDENT' });
    otherStudent = await createUser(prisma, { role: 'STUDENT' });
    instructor = await createUser(prisma, { role: 'INSTRUCTOR' });
    admin = await createUser(prisma, { role: 'ADMIN' });

    const categoryId = await createCategory(prisma);
    courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '990.00',
      status: CourseStatus.PUBLISHED,
    });
    await enrol(prisma, { courseId, studentId: student.id });

    const thread = await prisma.qnaThread.create({
      data: { courseId, studentId: student.id, title: 'คำถามทดสอบ', body: 'รายละเอียดคำถาม' },
      select: { id: true },
    });
    threadId = thread.id;
  });

  // -------------------------------------------------------------------------
  // Reporting
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('lets any signed-in role report a course', async () => {
      for (const reporter of [student, instructor, admin]) {
        await reports.create(asAuthUser(reporter), {
          targetType: ContentReportTargetType.COURSE,
          targetId: courseId,
          reason: 'เนื้อหาไม่ตรงกับที่โฆษณาไว้เลยสักนิด',
        });
      }

      expect(await prisma.contentReport.count({ where: { targetId: courseId } })).toBe(3);
    });

    it('refuses a course id that does not exist', async () => {
      await expect(
        reports.create(asAuthUser(student), {
          targetType: ContentReportTargetType.COURSE,
          targetId: 'no-such-course',
          reason: 'คอร์สนี้ไม่มีอยู่จริงในระบบ',
        }),
      ).rejects.toBeInstanceOf(CourseNotFoundException);
    });

    it('lets an enrolled student report a Q&A thread they can read', async () => {
      await reports.create(asAuthUser(student), {
        targetType: ContentReportTargetType.QNA_THREAD,
        targetId: threadId,
        reason: 'กระทู้นี้มีคำพูดไม่เหมาะสมปะปนอยู่',
      });

      expect(await prisma.contentReport.count({ where: { targetId: threadId } })).toBe(1);
    });

    it('refuses to report a Q&A thread on a course the reporter never bought', async () => {
      await expect(
        reports.create(asAuthUser(otherStudent), {
          targetType: ContentReportTargetType.QNA_THREAD,
          targetId: threadId,
          reason: 'กระทู้นี้มีคำพูดไม่เหมาะสมปะปนอยู่',
        }),
      ).rejects.toBeInstanceOf(QnaAccessDeniedException);

      expect(await prisma.contentReport.count()).toBe(0);
    });

    it('lets the course owner and an admin report a thread too, per the same Q&A access rule', async () => {
      for (const reporter of [instructor, admin]) {
        await reports.create(asAuthUser(reporter), {
          targetType: ContentReportTargetType.QNA_THREAD,
          targetId: threadId,
          reason: 'กระทู้นี้มีคำพูดไม่เหมาะสมปะปนอยู่',
        });
      }

      expect(await prisma.contentReport.count({ where: { targetId: threadId } })).toBe(2);
    });

    it('refuses a thread id that does not exist', async () => {
      await expect(
        reports.create(asAuthUser(student), {
          targetType: ContentReportTargetType.QNA_THREAD,
          targetId: 'no-such-thread',
          reason: 'กระทู้นี้ไม่มีอยู่จริงในระบบ',
        }),
      ).rejects.toBeInstanceOf(QnaThreadNotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // Admin queue
  // -------------------------------------------------------------------------

  describe('listForAdmin', () => {
    it('lists oldest first and filters by status', async () => {
      const first = await prisma.contentReport.create({
        data: {
          reporterId: student.id,
          targetType: ContentReportTargetType.COURSE,
          targetId: courseId,
          reason: 'เหตุผลข้อแรกที่แจ้งเข้ามาก่อน',
        },
        select: { id: true },
      });
      await prisma.contentReport.create({
        data: {
          reporterId: student.id,
          targetType: ContentReportTargetType.COURSE,
          targetId: courseId,
          reason: 'เหตุผลข้อที่สองที่แจ้งเข้ามาทีหลัง',
          status: ContentReportStatus.DISMISSED,
        },
      });

      const pending = await reports.listForAdmin({ status: ContentReportStatus.PENDING });
      expect(pending.items).toHaveLength(1);
      expect(pending.items[0].id).toBe(first.id);

      const all = await reports.listForAdmin({});
      expect(all.total).toBe(2);
    });
  });

  describe('review', () => {
    async function createPendingReport(): Promise<string> {
      const report = await prisma.contentReport.create({
        data: {
          reporterId: student.id,
          targetType: ContentReportTargetType.COURSE,
          targetId: courseId,
          reason: 'คอร์สนี้มีเนื้อหาที่ต้องตรวจสอบ',
        },
        select: { id: true },
      });
      return report.id;
    }

    it('dismisses a report without touching the course', async () => {
      const reportId = await createPendingReport();

      const result = await reports.review(reportId, asAuthUser(admin), { status: 'DISMISSED' });

      expect(result.status).toBe('DISMISSED');
      expect(result.reviewedBy?.id).toBe(admin.id);
      const course = await prisma.course.findUniqueOrThrow({
        where: { id: courseId },
        select: { status: true },
      });
      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('suspends the course when reviewed with suspendCourse', async () => {
      const reportId = await createPendingReport();

      await reports.review(reportId, asAuthUser(admin), {
        status: 'REVIEWED',
        suspendCourse: true,
      });

      const course = await prisma.course.findUniqueOrThrow({
        where: { id: courseId },
        select: { status: true },
      });
      expect(course.status).toBe(CourseStatus.SUSPENDED);
    });

    it('leaves the course alone when reviewed without asking to suspend', async () => {
      const reportId = await createPendingReport();

      await reports.review(reportId, asAuthUser(admin), { status: 'REVIEWED' });

      const course = await prisma.course.findUniqueOrThrow({
        where: { id: courseId },
        select: { status: true },
      });
      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('ignores suspendCourse on a dismissal', async () => {
      const reportId = await createPendingReport();

      await reports.review(reportId, asAuthUser(admin), {
        status: 'DISMISSED',
        suspendCourse: true,
      });

      const course = await prisma.course.findUniqueOrThrow({
        where: { id: courseId },
        select: { status: true },
      });
      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('refuses to review the same report twice', async () => {
      const reportId = await createPendingReport();
      await reports.review(reportId, asAuthUser(admin), { status: 'DISMISSED' });

      await expect(
        reports.review(reportId, asAuthUser(admin), { status: 'REVIEWED', suspendCourse: true }),
      ).rejects.toBeInstanceOf(ContentReportAlreadyReviewedException);
    });

    it('refuses a report id that does not exist', async () => {
      await expect(
        reports.review('no-such-report', asAuthUser(admin), { status: 'DISMISSED' }),
      ).rejects.toBeInstanceOf(ContentReportNotFoundException);
    });
  });

  describe('restoreCourse', () => {
    async function createSuspendedCourseReport(): Promise<string> {
      const reportId = await createPendingReport();
      await reports.review(reportId, asAuthUser(admin), {
        status: 'REVIEWED',
        suspendCourse: true,
      });
      return reportId;
    }

    async function createPendingReport(): Promise<string> {
      const report = await prisma.contentReport.create({
        data: {
          reporterId: student.id,
          targetType: ContentReportTargetType.COURSE,
          targetId: courseId,
          reason: 'คอร์สนี้มีเนื้อหาที่ต้องตรวจสอบ',
        },
        select: { id: true },
      });
      return report.id;
    }

    it('publishes the course again and dismisses the report', async () => {
      const reportId = await createSuspendedCourseReport();

      const result = await reports.restoreCourse(reportId, asAuthUser(admin));

      expect(result.status).toBe('DISMISSED');
      expect(result.courseStatus).toBe('PUBLISHED');
      expect(result.reviewedBy?.id).toBe(admin.id);
      const course = await prisma.course.findUniqueOrThrow({
        where: { id: courseId },
        select: { status: true },
      });
      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('refuses a course that was never suspended', async () => {
      const reportId = await createPendingReport();

      await expect(reports.restoreCourse(reportId, asAuthUser(admin))).rejects.toBeInstanceOf(
        CourseNotSuspendedException,
      );

      const course = await prisma.course.findUniqueOrThrow({
        where: { id: courseId },
        select: { status: true },
      });
      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('refuses a course that has since been restored already', async () => {
      const reportId = await createSuspendedCourseReport();
      await reports.restoreCourse(reportId, asAuthUser(admin));

      await expect(reports.restoreCourse(reportId, asAuthUser(admin))).rejects.toBeInstanceOf(
        CourseNotSuspendedException,
      );
    });

    it('refuses a Q&A thread report, which never suspends a course at all', async () => {
      const report = await prisma.contentReport.create({
        data: {
          reporterId: student.id,
          targetType: ContentReportTargetType.QNA_THREAD,
          targetId: threadId,
          reason: 'กระทู้นี้มีคำพูดไม่เหมาะสมปะปนอยู่',
        },
        select: { id: true },
      });

      await expect(reports.restoreCourse(report.id, asAuthUser(admin))).rejects.toBeInstanceOf(
        CourseNotSuspendedException,
      );
    });

    it('refuses a report id that does not exist', async () => {
      await expect(
        reports.restoreCourse('no-such-report', asAuthUser(admin)),
      ).rejects.toBeInstanceOf(ContentReportNotFoundException);
    });
  });

  describe('a suspended course', () => {
    it('drops out of the public catalog but stays reachable by its buyer', async () => {
      const reportId = await prisma.contentReport
        .create({
          data: {
            reporterId: student.id,
            targetType: ContentReportTargetType.COURSE,
            targetId: courseId,
            reason: 'เนื้อหาไม่เหมาะสมต้องตรวจสอบก่อน',
          },
          select: { id: true },
        })
        .then((r) => r.id);
      await reports.review(reportId, asAuthUser(admin), {
        status: 'REVIEWED',
        suspendCourse: true,
      });

      const access = new CourseAccessService(prisma);
      // The public/guest view: SUSPENDED behaves like every other non-PUBLISHED status.
      expect(() =>
        access.assertCourseVisible(
          { instructorId: instructor.id, status: CourseStatus.SUSPENDED },
          null,
        ),
      ).toThrow();
      // The buyer's classroom access is decided by Enrollment alone, never by Course.status.
      await expect(access.assertEnrolled(courseId, student.id)).resolves.toBeDefined();
    });
  });
});
