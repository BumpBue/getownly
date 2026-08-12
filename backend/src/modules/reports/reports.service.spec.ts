import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/infra/prisma.service';
import { LedgerService } from '@/modules/ledger/ledger.service';
import { WalletService } from '@/modules/ledger/wallet.service';
import { ReportsService } from './reports.service';
import { todayInBangkok, shiftDate } from './report-range';
import {
  createCategory,
  createCourse,
  createSystemAccounts,
  createUser,
  fundWallet,
  resetDatabase,
  type TestUser,
} from '../../../test/factories';
import { assertLedgerInvariants } from '../../../test/invariants';

/**
 * Moves a purchase's ledger transaction back in time.
 *
 * The ledger is append-only for *amounts* (CLAUDE.md, ข้อห้าม 5); this only
 * moves `createdAt` so a test can build a history without waiting a month, and
 * it is the one place in the suite that does so.
 */
async function backdate(prisma: PrismaService, enrollmentId: string, days: number): Promise<void> {
  const when = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  await prisma.$executeRaw`
    UPDATE "LedgerTransaction" SET "createdAt" = ${when} WHERE "referenceId" = ${enrollmentId}
  `;
}

describe('ReportsService', () => {
  let prisma: PrismaService;
  let ledger: LedgerService;
  let wallet: WalletService;
  let reports: ReportsService;

  let admin: TestUser;
  let instructor: TestUser;
  let otherInstructor: TestUser;
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
    ledger = new LedgerService(prisma);
    wallet = new WalletService(prisma, ledger);
    reports = new ReportsService(prisma);

    await createSystemAccounts(prisma);
    admin = await createUser(prisma, { role: 'ADMIN' });
    instructor = await createUser(prisma, {
      role: 'INSTRUCTOR',
      commissionRate: '0.3000',
      displayName: 'ครูคนแรก',
    });
    otherInstructor = await createUser(prisma, {
      role: 'INSTRUCTOR',
      commissionRate: '0.2000',
      displayName: 'ครูคนที่สอง',
    });
    student = await createUser(prisma, { role: 'STUDENT' });
    categoryId = await createCategory(prisma);
  });

  /** One 1,000 baht sale at 30%: 700 to the instructor, 300 to the platform. */
  async function sellOne(options: { instructorId: string; price: string; title?: string }) {
    const courseId = await createCourse(prisma, {
      instructorId: options.instructorId,
      categoryId,
      price: options.price,
      title: options.title,
    });
    const buyer = await createUser(prisma, { role: 'STUDENT' });
    await fundWallet(prisma, wallet, {
      studentId: buyer.id,
      adminId: admin.id,
      amount: '10000.00',
    });
    const purchase = await wallet.purchaseCourse(buyer.id, courseId);

    return { courseId, buyerId: buyer.id, enrollmentId: purchase.enrollmentId };
  }

  // --- the headline numbers -------------------------------------------------

  it('reports every side of a sale from the ledger, not from the enrolment', async () => {
    const sale = await sellOne({ instructorId: instructor.id, price: '1000.00' });

    // Rewriting the course price must not move a number in a past report
    // (CLAUDE.md, ข้อห้าม 4).
    await prisma.course.update({ where: { id: sale.courseId }, data: { price: '5.00' } });

    const overview = await reports.adminOverview({});

    expect(overview.grossSales.value).toBe('1000.00');
    expect(overview.platformRevenue.value).toBe('300.00');
    expect(overview.instructorPayable.value).toBe('700.00');
    expect(overview.salesCount.value).toBe('1');

    // The two halves of the split add back up to what was paid.
    expect(Number(overview.platformRevenue.value) + Number(overview.instructorPayable.value)).toBe(
      Number(overview.grossSales.value),
    );

    await assertLedgerInvariants(prisma, ledger);
  });

  it('leaves top-ups out of sales, because nothing was sold', async () => {
    await fundWallet(prisma, wallet, {
      studentId: student.id,
      adminId: admin.id,
      amount: '5000.00',
    });

    const overview = await reports.adminOverview({});

    expect(overview.grossSales.value).toBe('0.00');
    expect(overview.salesCount.value).toBe('0');
  });

  it('counts a free enrolment as a sale of nothing at all', async () => {
    const courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '0.00',
    });
    await wallet.purchaseCourse(student.id, courseId);

    const overview = await reports.adminOverview({});

    // A free course writes no ledger transaction, so the report has nothing
    // to count — which is the honest answer for money that never moved.
    expect(overview.grossSales.value).toBe('0.00');
    expect(overview.salesCount.value).toBe('0');
  });

  it('compares against the period immediately before, of the same length', async () => {
    const older = await sellOne({ instructorId: instructor.id, price: '1000.00' });
    await backdate(prisma, older.enrollmentId, 10);
    await sellOne({ instructorId: instructor.id, price: '3000.00' });

    const today = todayInBangkok();
    const overview = await reports.adminOverview({ from: shiftDate(today, -6), to: today });

    expect(overview.range.previousTo).toBe(shiftDate(today, -7));
    expect(overview.range.previousFrom).toBe(shiftDate(today, -13));
    expect(overview.grossSales.value).toBe('3000.00');
    expect(overview.grossSales.previousValue).toBe('1000.00');
    expect(overview.grossSales.changePercent).toBe(200);
  });

  it('reports no percentage at all when the previous period was empty', async () => {
    await sellOne({ instructorId: instructor.id, price: '1000.00' });

    const overview = await reports.adminOverview({});

    // Not 100%, not infinity: there is no percentage from nothing.
    expect(overview.grossSales.previousValue).toBe('0.00');
    expect(overview.grossSales.changePercent).toBeNull();
  });

  it('refuses a range that runs backwards', async () => {
    await expect(
      reports.adminOverview({ from: '2026-08-10', to: '2026-08-01' }),
    ).rejects.toMatchObject({ code: 'INVALID_DATE_RANGE' });
  });

  it('counts new users in the window', async () => {
    const overview = await reports.adminOverview({});

    // admin, two instructors and a student were all created by the fixture.
    expect(Number(overview.newUsers.value)).toBeGreaterThanOrEqual(4);
  });

  // --- the daily chart ------------------------------------------------------

  it('gives every day in the window a point, including the quiet ones', async () => {
    await sellOne({ instructorId: instructor.id, price: '500.00' });

    const today = todayInBangkok();
    const chart = await reports.dailySales({ from: shiftDate(today, -6), to: today });

    expect(chart.points).toHaveLength(7);
    expect(chart.points[0]?.date).toBe(shiftDate(today, -6));
    expect(chart.points.at(-1)?.date).toBe(today);
    expect(chart.points.at(-1)?.grossSales).toBe('500.00');
    // A day with no sales is a zero, not a gap.
    expect(chart.points[0]?.grossSales).toBe('0.00');
  });

  it('puts a sale on the Thai calendar day it happened', async () => {
    await sellOne({ instructorId: instructor.id, price: '900.00' });

    const chart = await reports.dailySales({});
    const withSales = chart.points.filter((point) => point.salesCount > 0);

    expect(withSales).toHaveLength(1);
    expect(withSales[0]?.date).toBe(todayInBangkok());
  });

  // --- the top lists --------------------------------------------------------

  it('ranks courses by what they actually took', async () => {
    const cheap = await sellOne({
      instructorId: instructor.id,
      price: '300.00',
      title: 'คอร์สราคาถูก',
    });
    const dear = await sellOne({
      instructorId: instructor.id,
      price: '2500.00',
      title: 'คอร์สราคาแพง',
    });

    const top = await reports.topCourses({});

    expect(top).toHaveLength(2);
    expect(top[0]?.title).toBe('คอร์สราคาแพง');
    expect(top[0]?.grossSales).toBe('2500.00');
    expect(top[0]?.platformRevenue).toBe('750.00');
    expect(top[0]?.instructorName).toBe('ครูคนแรก');
    expect(top[1]?.title).toBe('คอร์สราคาถูก');
    expect(cheap.courseId).not.toBe(dear.courseId);
  });

  it('ranks instructors by earnings and shows what is still owed', async () => {
    await sellOne({ instructorId: instructor.id, price: '1000.00' });
    await sellOne({ instructorId: otherInstructor.id, price: '1000.00' });

    const top = await reports.topInstructors({});

    // 20% commission keeps more of the same price than 30% does.
    expect(top[0]?.displayName).toBe('ครูคนที่สอง');
    expect(top[0]?.earnings).toBe('800.00');
    expect(top[1]?.displayName).toBe('ครูคนแรก');
    expect(top[1]?.earnings).toBe('700.00');
    // Nothing has been paid out, so everything earned is still outstanding.
    expect(top[1]?.outstandingAmount).toBe('700.00');
  });

  it('leaves an instructor who sold nothing in the window off the list', async () => {
    const sale = await sellOne({ instructorId: instructor.id, price: '1000.00' });
    await backdate(prisma, sale.enrollmentId, 90);

    const today = todayInBangkok();
    const top = await reports.topInstructors({ from: shiftDate(today, -6), to: today });

    expect(top).toHaveLength(0);
  });

  // --- the instructor's own report -----------------------------------------

  it('reports an instructor their own share and their own gross', async () => {
    await sellOne({ instructorId: instructor.id, price: '1000.00' });
    await sellOne({ instructorId: instructor.id, price: '2000.00' });
    await sellOne({ instructorId: otherInstructor.id, price: '9000.00' });

    const overview = await reports.instructorOverview(instructor.id);

    expect(overview.totalGrossSales).toBe('3000.00');
    expect(overview.totalEarnings).toBe('2100.00');
    expect(overview.totalSalesCount).toBe(2);
    expect(overview.studentCount).toBe(2);
    // Their wallet holds exactly what they earned, nothing having been spent.
    expect(overview.walletBalance).toBe('2100.00');
  });

  it("never mixes one instructor's sales into another's report", async () => {
    await sellOne({ instructorId: otherInstructor.id, price: '5000.00' });

    const overview = await reports.instructorOverview(instructor.id);

    expect(overview.totalEarnings).toBe('0.00');
    expect(overview.totalSalesCount).toBe(0);
    expect(overview.monthly.every((point) => point.earnings === '0.00')).toBe(true);
  });

  it('draws six months whether or not anything sold in them', async () => {
    await sellOne({ instructorId: instructor.id, price: '1000.00' });

    const overview = await reports.instructorOverview(instructor.id);

    expect(overview.monthly).toHaveLength(6);
    expect(overview.monthly.at(-1)?.earnings).toBe('700.00');
    expect(overview.monthly.at(-1)?.label).toMatch(/[ก-๙]/);
    // Oldest first, so the bars read left to right as time does.
    expect(overview.monthly[0]?.month.localeCompare(overview.monthly[5]?.month ?? '')).toBeLessThan(
      0,
    );
  });

  it('lists a course with no sales at zero rather than leaving it out', async () => {
    await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '1500.00',
      title: 'คอร์สที่ยังไม่มีใครซื้อ',
    });

    const overview = await reports.instructorOverview(instructor.id);

    expect(overview.courses).toHaveLength(1);
    expect(overview.courses[0]?.title).toBe('คอร์สที่ยังไม่มีใครซื้อ');
    expect(overview.courses[0]?.salesCount).toBe(0);
    expect(overview.courses[0]?.earnings).toBe('0.00');
  });

  it("splits each course's gross and earnings the way the ledger did", async () => {
    await sellOne({ instructorId: instructor.id, price: '1000.00', title: 'คอร์สที่ขายได้' });

    const overview = await reports.instructorOverview(instructor.id);
    const row = overview.courses.find((course) => course.title === 'คอร์สที่ขายได้');

    expect(row?.salesCount).toBe(1);
    expect(row?.grossSales).toBe('1000.00');
    expect(row?.earnings).toBe('700.00');
  });

  it('agrees with the admin report on the same sale', async () => {
    await sellOne({ instructorId: instructor.id, price: '1290.00' });
    await sellOne({ instructorId: otherInstructor.id, price: '990.00' });

    const [platform, first, second] = await Promise.all([
      reports.adminOverview({}),
      reports.instructorOverview(instructor.id),
      reports.instructorOverview(otherInstructor.id),
    ]);

    // Two reports, one ledger: the instructors' earnings must add up to the
    // payable figure the admin sees, to the satang.
    expect(Number(first.totalEarnings) + Number(second.totalEarnings)).toBe(
      Number(platform.instructorPayable.value),
    );
    expect(Number(first.totalGrossSales) + Number(second.totalGrossSales)).toBe(
      Number(platform.grossSales.value),
    );

    await assertLedgerInvariants(prisma, ledger);
  });
});
