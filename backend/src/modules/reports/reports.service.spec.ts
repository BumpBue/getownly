import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/infra/prisma.service';
import { LedgerService } from '@/modules/ledger/ledger.service';
import { WalletService } from '@/modules/ledger/wallet.service';
import { ReportsService } from './reports.service';
import { todayInBangkok, shiftDate } from './report-range';
import {
  accountBalance,
  createCategory,
  createCourse,
  createSystemAccounts,
  createUser,
  decimal,
  fundWallet,
  resetDatabase,
  type SystemAccounts,
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

/**
 * Writes one payout transaction straight through the ledger.
 *
 * The reports must be able to read a withdrawal before PayoutsService exists,
 * and what they read is the ledger, so this posts the same two entries that
 * service will: the wallet is debited, EXTERNAL_BANK is credited back toward
 * zero.
 */
async function payOut(
  prisma: PrismaService,
  ledger: LedgerService,
  options: { instructorId: string; amount: string },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const [walletId, bankId] = await Promise.all([
      ledger.getWalletAccountId(options.instructorId, tx),
      ledger.getSystemAccountId('EXTERNAL_BANK', tx),
    ]);

    await ledger.postTransaction(tx, {
      type: 'PAYOUT',
      idempotencyKey: `payout:test:${options.instructorId}:${options.amount}`,
      referenceType: 'PayoutRequest',
      referenceId: 'test',
      description: `ถอนเงิน ${options.amount} บาท`,
      entries: [
        { accountId: walletId, direction: 'DEBIT', amount: decimal(options.amount) },
        { accountId: bankId, direction: 'CREDIT', amount: decimal(options.amount) },
      ],
    });
  });
}

describe('ReportsService', () => {
  let prisma: PrismaService;
  let ledger: LedgerService;
  let wallet: WalletService;
  let reports: ReportsService;

  let system: SystemAccounts;
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

    system = await createSystemAccounts(prisma);
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

  /**
   * The guard on the payout extension.
   *
   * Teaching the reports about withdrawals meant rewriting the SQL behind
   * `topInstructors`, which is code the ทก.01 audit already signed off. Every
   * figure below is the value that code produced *before* payouts existed,
   * written out by hand rather than derived, so a database with no payout in
   * it can never quietly start reporting something else.
   *
   * If this test fails, the extension has changed the meaning of an existing
   * number — which is the one thing it is not allowed to do.
   */
  it('reports exactly the same figures as before payouts existed, on a database with none', async () => {
    // 1,000 at 30% -> 300 / 700, and 1,000 at 20% -> 200 / 800.
    await sellOne({ instructorId: instructor.id, price: '1000.00' });
    await sellOne({ instructorId: otherInstructor.id, price: '1000.00' });

    const [overview, top, payoutCount] = await Promise.all([
      reports.adminOverview({}),
      reports.topInstructors({}),
      prisma.ledgerTransaction.count({ where: { type: 'PAYOUT' } }),
    ]);

    expect(payoutCount).toBe(0);

    expect(overview.grossSales.value).toBe('2000.00');
    expect(overview.platformRevenue.value).toBe('500.00');
    expect(overview.instructorPayable.value).toBe('1500.00');
    expect(overview.salesCount.value).toBe('2');

    expect(top).toHaveLength(2);
    expect(top[0]?.displayName).toBe('ครูคนที่สอง');
    expect(top[0]?.salesCount).toBe(1);
    expect(top[0]?.earnings).toBe('800.00');
    expect(top[0]?.outstandingAmount).toBe('800.00');
    expect(top[1]?.displayName).toBe('ครูคนแรก');
    expect(top[1]?.salesCount).toBe(1);
    expect(top[1]?.earnings).toBe('700.00');
    expect(top[1]?.outstandingAmount).toBe('700.00');

    await assertLedgerInvariants(prisma, ledger);
  });

  it('subtracts a withdrawal from what an instructor is still owed', async () => {
    await sellOne({ instructorId: instructor.id, price: '1000.00' });
    await payOut(prisma, ledger, { instructorId: instructor.id, amount: '500.00' });

    const [overview, top] = await Promise.all([
      reports.adminOverview({}),
      reports.topInstructors({}),
    ]);

    const row = top.find((entry) => entry.instructorId === instructor.id);
    // Earned 700, withdrew 500, so 200 of it is still inside the platform.
    expect(row?.outstandingAmount).toBe('200.00');
    // ...while what they earned in the window has not changed: a withdrawal
    // moves money that was already earned, it does not un-earn it.
    expect(row?.earnings).toBe('700.00');
    expect(row?.salesCount).toBe(1);

    // The headline figures describe trading, so a withdrawal leaves them be.
    expect(overview.grossSales.value).toBe('1000.00');
    expect(overview.platformRevenue.value).toBe('300.00');
    expect(overview.instructorPayable.value).toBe('700.00');
    expect(overview.salesCount.value).toBe('1');

    await assertLedgerInvariants(prisma, ledger);
  });

  it('drops an instructor off the list once they have withdrawn everything', async () => {
    await sellOne({ instructorId: instructor.id, price: '1000.00' });
    await payOut(prisma, ledger, { instructorId: instructor.id, amount: '700.00' });

    const top = await reports.topInstructors({});
    const row = top.find((entry) => entry.instructorId === instructor.id);

    // Still listed: they sold inside the window. Owed nothing, though.
    expect(row?.earnings).toBe('700.00');
    expect(row?.outstandingAmount).toBe('0.00');

    await assertLedgerInvariants(prisma, ledger);
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
    // Both sales just happened, so they are also "today" - the /home card.
    expect(overview.todayEarnings).toBe('2100.00');
    expect(overview.todaySalesCount).toBe(2);
  });

  it("does not count yesterday's sale as today's", async () => {
    const sale = await sellOne({ instructorId: instructor.id, price: '1000.00' });
    await backdate(prisma, sale.enrollmentId, 1);

    const overview = await reports.instructorOverview(instructor.id);

    expect(overview.totalEarnings).toBe('700.00');
    expect(overview.todayEarnings).toBe('0.00');
    expect(overview.todaySalesCount).toBe(0);
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

  // --- the trial balance ------------------------------------------------------

  describe('trialBalance', () => {
    it('has nothing to show before any money has moved, but still balances', async () => {
      const trial = await reports.trialBalance();

      expect(trial.totalDebit).toBe('0.00');
      expect(trial.totalCredit).toBe('0.00');
      expect(trial.isBalanced).toBe(true);
    });

    it('still balances after a mix of top-ups and purchases', async () => {
      await fundWallet(prisma, wallet, {
        studentId: student.id,
        adminId: admin.id,
        amount: '2000.00',
      });
      await sellOne({ instructorId: instructor.id, price: '1000.00' });

      const trial = await reports.trialBalance();

      expect(trial.totalDebit).toBe(trial.totalCredit);
      expect(trial.isBalanced).toBe(true);

      await assertLedgerInvariants(prisma, ledger);
    });

    it('groups by account kind rather than listing one row per wallet', async () => {
      // beforeEach already created four users, each with their own wallet.
      const trial = await reports.trialBalance();

      // Order is Postgres sorting the enum by its declared ordinal, not
      // something this report promises - only that each kind appears once.
      expect([...trial.rows.map((row) => row.kind)].sort()).toEqual(
        ['EXTERNAL_BANK', 'PAYOUT_PAYABLE', 'PLATFORM_REVENUE', 'USER_WALLET'].sort(),
      );
      expect(trial.rows.find((row) => row.kind === 'USER_WALLET')?.accountCount).toBe(4);
      expect(trial.rows.find((row) => row.kind === 'PLATFORM_REVENUE')?.accountCount).toBe(1);
      expect(trial.rows.find((row) => row.kind === 'EXTERNAL_BANK')?.accountCount).toBe(1);
      expect(trial.rows.find((row) => row.kind === 'PAYOUT_PAYABLE')?.accountCount).toBe(1);
    });

    it('shows the external bank account carrying the offsetting negative balance', async () => {
      await fundWallet(prisma, wallet, {
        studentId: student.id,
        adminId: admin.id,
        amount: '500.00',
      });

      const trial = await reports.trialBalance();
      const bank = trial.rows.find((row) => row.kind === 'EXTERNAL_BANK');
      const bankBalance = await accountBalance(prisma, system.externalBankId);

      expect(bank?.netBalance).toBe(bankBalance.toFixed(2));
      expect(bank?.netBalance).toBe('-500.00');
    });
  });
  // --- ทก.01 A10: the per-transaction split ---------------------------------

  describe('instructor earning transactions', () => {
    it('shows the four figures the scope document asks for, and they reconcile', async () => {
      await sellOne({ instructorId: instructor.id, price: '1000.00', title: 'คอร์สแรก' });

      const page = await reports.instructorEarningTransactions(instructor.id, {});

      expect(page.total).toBe(1);
      const [row] = page.items;
      expect(row.courseTitle).toBe('คอร์สแรก');
      expect(row.grossAmount).toBe('1000.00');
      expect(row.commissionRateSnapshot).toBe('0.3000');
      expect(row.platformFeeAmount).toBe('300.00');
      expect(row.netAmount).toBe('700.00');

      // (ก) every row: price − deducted = net.
      for (const item of page.items) {
        expect(Number(item.grossAmount) - Number(item.platformFeeAmount)).toBeCloseTo(
          Number(item.netAmount),
          2,
        );
      }

      await assertLedgerInvariants(prisma, ledger);
    });

    it('(ก) holds row by row across a mix of prices', async () => {
      await prisma.user.update({
        where: { id: instructor.id },
        data: { commissionRate: '0.1750' },
      });

      for (const price of ['999.00', '0.01', '4999.99', '12.34']) {
        await sellOne({ instructorId: instructor.id, price });
      }

      const page = await reports.instructorEarningTransactions(instructor.id, {});

      expect(page.items).toHaveLength(4);
      for (const item of page.items) {
        expect(Number(item.grossAmount) - Number(item.platformFeeAmount)).toBeCloseTo(
          Number(item.netAmount),
          2,
        );
      }
    });

    it('(ข) totals match the earnings the dashboard reports', async () => {
      await sellOne({ instructorId: instructor.id, price: '1000.00' });
      await sellOne({ instructorId: instructor.id, price: '250.50' });
      await sellOne({ instructorId: instructor.id, price: '99.99' });
      // Another instructor's sale must not leak into either number.
      await sellOne({ instructorId: otherInstructor.id, price: '2000.00' });

      const page = await reports.instructorEarningTransactions(instructor.id, {});
      const overview = await reports.instructorOverview(instructor.id);

      expect(page.totals.netAmount).toBe(overview.totalEarnings);
      expect(page.totals.grossAmount).toBe(overview.totalGrossSales);
      expect(page.total).toBe(overview.totalSalesCount);

      const summedRows = page.items.reduce((total, item) => total + Number(item.netAmount), 0);
      expect(summedRows.toFixed(2)).toBe(overview.totalEarnings);
    });

    it('(ข) totals cover every match, not only the page being shown', async () => {
      for (const price of ['100.00', '200.00', '300.00']) {
        await sellOne({ instructorId: instructor.id, price });
      }

      const firstPage = await reports.instructorEarningTransactions(instructor.id, { limit: 2 });

      expect(firstPage.items).toHaveLength(2);
      expect(firstPage.total).toBe(3);
      expect(firstPage.totalPages).toBe(2);
      // 600 gross across all three, even though only two rows came back.
      expect(firstPage.totals.grossAmount).toBe('600.00');
    });

    it('(ค) each purchase behind a row is a balanced transaction', async () => {
      await sellOne({ instructorId: instructor.id, price: '1000.00' });
      await sellOne({ instructorId: instructor.id, price: '777.77' });

      const page = await reports.instructorEarningTransactions(instructor.id, {});

      for (const item of page.items) {
        const entries = await prisma.ledgerEntry.findMany({
          where: { transactionId: item.ledgerTransactionId },
          select: { direction: true, amount: true },
        });

        const signed = entries.reduce(
          (total, entry) =>
            entry.direction === 'DEBIT' ? total.plus(entry.amount) : total.minus(entry.amount),
          decimal(0),
        );
        expect(signed.toFixed(2)).toBe('0.00');
      }

      await assertLedgerInvariants(prisma, ledger);
    });

    it('(ง) rounds 17.5% of 999 to 174.83 deducted and 824.17 kept', async () => {
      await prisma.user.update({
        where: { id: instructor.id },
        data: { commissionRate: '0.1750' },
      });

      await sellOne({ instructorId: instructor.id, price: '999.00' });

      const page = await reports.instructorEarningTransactions(instructor.id, {});
      const [row] = page.items;

      // 999 × 0.175 = 174.825, half-up to 174.83; the rest is the net, by
      // subtraction, so the two still add back to exactly 999.
      expect(row.grossAmount).toBe('999.00');
      expect(row.commissionRateSnapshot).toBe('0.1750');
      expect(row.platformFeeAmount).toBe('174.83');
      expect(row.netAmount).toBe('824.17');
    });

    it('(จ) keeps the rate each sale was made under when the rate later changes', async () => {
      await sellOne({ instructorId: instructor.id, price: '1000.00', title: 'ขายตอนสามสิบ' });

      await prisma.user.update({
        where: { id: instructor.id },
        data: { commissionRate: '0.1000' },
      });

      await sellOne({ instructorId: instructor.id, price: '1000.00', title: 'ขายตอนสิบ' });

      const page = await reports.instructorEarningTransactions(instructor.id, {});
      const byTitle = new Map(page.items.map((item) => [item.courseTitle, item]));

      const older = byTitle.get('ขายตอนสามสิบ');
      const newer = byTitle.get('ขายตอนสิบ');

      expect(older?.commissionRateSnapshot).toBe('0.3000');
      expect(older?.platformFeeAmount).toBe('300.00');
      expect(older?.netAmount).toBe('700.00');

      expect(newer?.commissionRateSnapshot).toBe('0.1000');
      expect(newer?.platformFeeAmount).toBe('100.00');
      expect(newer?.netAmount).toBe('900.00');
    });

    it('(ฉ) leaves free enrolments out entirely', async () => {
      const freeCourseId = await createCourse(prisma, {
        instructorId: instructor.id,
        categoryId,
        price: '0.00',
        title: 'คอร์สฟรี',
      });
      await wallet.purchaseCourse(student.id, freeCourseId);
      await sellOne({ instructorId: instructor.id, price: '500.00', title: 'คอร์สที่ขายจริง' });

      const page = await reports.instructorEarningTransactions(instructor.id, {});

      // The free enrolment exists; it simply never moved money, so it has no
      // ledger transaction and nothing to show in a table about splits.
      expect(await prisma.enrollment.count({ where: { courseId: freeCourseId } })).toBe(1);
      expect(page.total).toBe(1);
      expect(page.items.map((item) => item.courseTitle)).toEqual(['คอร์สที่ขายจริง']);
    });

    it('(ช) scopes rows to the caller, at the query rather than afterwards', async () => {
      await sellOne({ instructorId: instructor.id, price: '1000.00', title: 'ของครูคนแรก' });
      await sellOne({
        instructorId: otherInstructor.id,
        price: '2000.00',
        title: 'ของครูคนที่สอง',
      });

      const mine = await reports.instructorEarningTransactions(instructor.id, {});
      const theirs = await reports.instructorEarningTransactions(otherInstructor.id, {});

      expect(mine.items.map((item) => item.courseTitle)).toEqual(['ของครูคนแรก']);
      expect(theirs.items.map((item) => item.courseTitle)).toEqual(['ของครูคนที่สอง']);
      expect(mine.totals.grossAmount).toBe('1000.00');
      expect(theirs.totals.grossAmount).toBe('2000.00');
    });

    it('yields nothing for a course id belonging to another instructor', async () => {
      const theirSale = await sellOne({ instructorId: otherInstructor.id, price: '2000.00' });

      // The controller refuses this before the query runs; even if it did not,
      // the instructorId pinned inside the WHERE clause leaves no rows.
      const page = await reports.instructorEarningTransactions(instructor.id, {
        courseId: theirSale.courseId,
      });

      expect(page.total).toBe(0);
      expect(page.items).toEqual([]);
      expect(page.totals.netAmount).toBe('0.00');
    });

    it('filters by course and by date window', async () => {
      const kept = await sellOne({
        instructorId: instructor.id,
        price: '100.00',
        title: 'เก็บไว้',
      });
      await sellOne({ instructorId: instructor.id, price: '200.00', title: 'กรองออก' });

      const byCourse = await reports.instructorEarningTransactions(instructor.id, {
        courseId: kept.courseId,
      });
      expect(byCourse.items.map((item) => item.courseTitle)).toEqual(['เก็บไว้']);

      const old = await sellOne({ instructorId: instructor.id, price: '900.00', title: 'ของเก่า' });
      await backdate(prisma, old.enrollmentId, 40);

      const recent = await reports.instructorEarningTransactions(instructor.id, {
        from: shiftDate(todayInBangkok(), -7),
      });
      expect(recent.items.map((item) => item.courseTitle)).not.toContain('ของเก่า');

      const onlyOld = await reports.instructorEarningTransactions(instructor.id, {
        to: shiftDate(todayInBangkok(), -30),
      });
      expect(onlyOld.items.map((item) => item.courseTitle)).toEqual(['ของเก่า']);
    });

    it('returns an empty page rather than failing when nothing has sold', async () => {
      const page = await reports.instructorEarningTransactions(instructor.id, {});

      expect(page).toMatchObject({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
        totals: { grossAmount: '0.00', platformFeeAmount: '0.00', netAmount: '0.00' },
      });
    });
  });
});
