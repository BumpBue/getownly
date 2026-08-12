import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/infra/prisma.service';
import { LedgerService } from '@/modules/ledger/ledger.service';
import { WalletService } from '@/modules/ledger/wallet.service';
import { EnrollmentsService } from './enrollments.service';
import {
  createCategory,
  createCourse,
  createLesson,
  createSystemAccounts,
  createUser,
  fundWallet,
  resetDatabase,
  type TestUser,
} from '../../../test/factories';
import { FakeStorage } from '../../../test/fake-storage';
import { assertLedgerInvariants } from '../../../test/invariants';

describe('EnrollmentsService', () => {
  let prisma: PrismaService;
  let storage: FakeStorage;
  let ledger: LedgerService;
  let wallet: WalletService;
  let enrollments: EnrollmentsService;

  let admin: TestUser;
  let instructor: TestUser;
  let student: TestUser;
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
    ledger = new LedgerService(prisma);
    wallet = new WalletService(prisma, ledger);
    enrollments = new EnrollmentsService(prisma, storage.asService());

    await createSystemAccounts(prisma);
    admin = await createUser(prisma, { role: 'ADMIN' });
    instructor = await createUser(prisma, {
      role: 'INSTRUCTOR',
      commissionRate: '0.3000',
      displayName: 'ครูทดสอบ',
    });
    student = await createUser(prisma, { role: 'STUDENT' });
    categoryId = await createCategory(prisma);
  });

  it('lists a bought course with the price that was actually charged', async () => {
    const courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '1290.00',
      title: 'คอร์สที่ซื้อแล้ว',
    });
    await createLesson(prisma, { courseId, orderIndex: 1, durationSec: 600 });
    await createLesson(prisma, { courseId, orderIndex: 2, durationSec: 900 });

    await fundWallet(prisma, wallet, {
      studentId: student.id,
      adminId: admin.id,
      amount: '2000.00',
    });
    await wallet.purchaseCourse(student.id, courseId);

    // The price moving afterwards must not rewrite what was paid.
    await prisma.course.update({
      where: { id: courseId },
      data: { price: '99.00' },
    });

    const [item] = await enrollments.listMine(student.id);

    expect(item.courseId).toBe(courseId);
    expect(item.courseTitle).toBe('คอร์สที่ซื้อแล้ว');
    expect(item.pricePaid).toBe('1290.00');
    expect(item.instructorName).toBe('ครูทดสอบ');
    expect(item.lessonCount).toBe(2);
    expect(item.totalDurationSec).toBe(1500);

    await assertLedgerInvariants(prisma, ledger);
  });

  it('counts only lessons marked complete, not lessons merely started', async () => {
    const courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '0.00',
    });
    const first = await createLesson(prisma, { courseId, orderIndex: 1 });
    const second = await createLesson(prisma, { courseId, orderIndex: 2 });
    const third = await createLesson(prisma, { courseId, orderIndex: 3 });
    const fourth = await createLesson(prisma, { courseId, orderIndex: 4 });

    const purchase = await wallet.purchaseCourse(student.id, courseId);

    await prisma.lessonProgress.createMany({
      data: [
        { enrollmentId: purchase.enrollmentId, lessonId: first, completedAt: new Date() },
        { enrollmentId: purchase.enrollmentId, lessonId: second, completedAt: new Date() },
        // Watched halfway and left: not progress.
        { enrollmentId: purchase.enrollmentId, lessonId: third, lastPositionSec: 120 },
      ],
    });

    const [item] = await enrollments.listMine(student.id);

    expect(item.lessonCount).toBe(4);
    expect(item.completedLessonCount).toBe(2);
    expect(item.progressPercent).toBe(50);
    expect(fourth).toBeDefined();
  });

  it('reports 0% rather than dividing by zero when a course has no lessons yet', async () => {
    const courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '0.00',
    });
    await wallet.purchaseCourse(student.id, courseId);

    const [item] = await enrollments.listMine(student.id);

    expect(item.lessonCount).toBe(0);
    expect(item.progressPercent).toBe(0);
  });

  it('never shows one student the courses of another', async () => {
    const other = await createUser(prisma, { role: 'STUDENT' });
    const courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '0.00',
    });
    await wallet.purchaseCourse(other.id, courseId);

    expect(await enrollments.listMine(student.id)).toHaveLength(0);
    expect(await enrollments.listMine(other.id)).toHaveLength(1);
  });
});
