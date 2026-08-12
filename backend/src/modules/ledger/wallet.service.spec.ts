import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CourseStatus, EntryDirection, TopupStatus, TxType } from '@prisma/client';
import { PrismaService } from '@/infra/prisma.service';
import { LedgerService } from './ledger.service';
import { WalletService } from './wallet.service';
import {
  AlreadyEnrolledException,
  CannotBuyOwnCourseException,
  CourseNotPurchasableException,
  InsufficientBalanceException,
  TopupNotPendingException,
} from './ledger.errors';
import {
  accountBalance,
  createCategory,
  createCourse,
  createSystemAccounts,
  createTopupRequest,
  createUser,
  fundWallet,
  resetDatabase,
  type SystemAccounts,
  type TestUser,
} from '../../../test/factories';
import { assertLedgerInvariants } from '../../../test/invariants';

describe('WalletService', () => {
  let prisma: PrismaService;
  let ledger: LedgerService;
  let wallet: WalletService;

  let system: SystemAccounts;
  let admin: TestUser;
  let instructor: TestUser;
  let student: TestUser;
  let categoryId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    ledger = new LedgerService(prisma);
    wallet = new WalletService(prisma, ledger);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    system = await createSystemAccounts(prisma);
    admin = await createUser(prisma, { role: 'ADMIN' });
    instructor = await createUser(prisma, {
      role: 'INSTRUCTOR',
      commissionRate: '0.3000',
    });
    student = await createUser(prisma, { role: 'STUDENT' });
    categoryId = await createCategory(prisma);
  });

  // -------------------------------------------------------------------------
  // Top-up review
  // -------------------------------------------------------------------------

  describe('approveTopup', () => {
    it('credits the wallet and debits the bank as one balanced transaction', async () => {
      const requestId = await createTopupRequest(prisma, {
        studentId: student.id,
        amount: '2500.00',
      });

      const result = await wallet.approveTopup(requestId, admin.id);

      expect(result.status).toBe(TopupStatus.APPROVED);
      expect(result.amount).toBe('2500.00');
      expect(result.walletBalance).toBe('2500.00');
      expect(result.ledgerTransactionId).not.toBeNull();

      const request = await prisma.topupRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
      expect(request.status).toBe(TopupStatus.APPROVED);
      expect(request.reviewedById).toBe(admin.id);
      expect(request.reviewedAt).not.toBeNull();

      expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('2500.00');
      expect((await accountBalance(prisma, system.externalBankId)).toFixed(2)).toBe('-2500.00');

      const transaction = await prisma.ledgerTransaction.findUniqueOrThrow({
        where: { id: result.ledgerTransactionId as string },
        include: { entries: true },
      });
      expect(transaction.type).toBe(TxType.TOPUP);
      expect(transaction.referenceType).toBe('TopupRequest');
      expect(transaction.referenceId).toBe(requestId);
      expect(transaction.entries).toHaveLength(2);

      await assertLedgerInvariants(prisma, ledger);
    });

    // Behaviour 11
    it('refuses to approve the same request twice and leaves the balance alone', async () => {
      const requestId = await createTopupRequest(prisma, {
        studentId: student.id,
        amount: '1000.00',
      });
      await wallet.approveTopup(requestId, admin.id);

      await expect(wallet.approveTopup(requestId, admin.id)).rejects.toBeInstanceOf(
        TopupNotPendingException,
      );

      expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('1000.00');
      expect(await prisma.ledgerTransaction.count()).toBe(1);
      await assertLedgerInvariants(prisma, ledger);
    });

    // PLAN.md phase 4: "กดปุ่มอนุมัติรัวๆ / ยิง API ซ้ำ 10 ครั้งพร้อมกัน → เงินเข้าครั้งเดียว"
    it('credits the wallet once when ten approvals arrive at the same moment', async () => {
      const requestId = await createTopupRequest(prisma, {
        studentId: student.id,
        amount: '750.00',
      });

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => wallet.approveTopup(requestId, admin.id)),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      for (const result of results.filter((r) => r.status === 'rejected')) {
        expect(result.reason).toBeInstanceOf(TopupNotPendingException);
      }

      expect(await prisma.ledgerTransaction.count()).toBe(1);
      expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('750.00');
      await assertLedgerInvariants(prisma, ledger);
    });

    it('refuses to approve a request that was already rejected', async () => {
      const requestId = await createTopupRequest(prisma, {
        studentId: student.id,
        amount: '1000.00',
      });
      await wallet.rejectTopup(requestId, admin.id, 'สลิปไม่ตรงกับยอดที่แจ้ง');

      await expect(wallet.approveTopup(requestId, admin.id)).rejects.toBeInstanceOf(
        TopupNotPendingException,
      );

      expect(await prisma.ledgerTransaction.count()).toBe(0);
    });
  });

  describe('rejectTopup', () => {
    it('records the reason and posts nothing to the ledger', async () => {
      const requestId = await createTopupRequest(prisma, {
        studentId: student.id,
        amount: '800.00',
      });

      const result = await wallet.rejectTopup(requestId, admin.id, 'สลิปอ่านไม่ออก');

      expect(result.status).toBe(TopupStatus.REJECTED);
      expect(result.ledgerTransactionId).toBeNull();
      expect(result.walletBalance).toBe('0.00');

      const request = await prisma.topupRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
      expect(request.status).toBe(TopupStatus.REJECTED);
      expect(request.note).toBe('สลิปอ่านไม่ออก');
      expect(request.reviewedById).toBe(admin.id);

      expect(await prisma.ledgerTransaction.count()).toBe(0);
      expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('0.00');
      await assertLedgerInvariants(prisma, ledger);
    });

    it('requires a reason', async () => {
      const requestId = await createTopupRequest(prisma, {
        studentId: student.id,
        amount: '800.00',
      });

      await expect(wallet.rejectTopup(requestId, admin.id, '   ')).rejects.toThrow();

      const request = await prisma.topupRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
      expect(request.status).toBe(TopupStatus.PENDING);
    });
  });

  // -------------------------------------------------------------------------
  // Purchase
  // -------------------------------------------------------------------------

  describe('purchaseCourse', () => {
    it('splits the price, snapshots the rate and posts three entries', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: instructor.id,
        categoryId,
        price: '1000.00',
        title: 'พื้นฐานการใช้งาน Autodesk Maya',
      });
      await fundWallet(prisma, wallet, {
        studentId: student.id,
        adminId: admin.id,
        amount: '1000.00',
      });

      const result = await wallet.purchaseCourse(student.id, courseId);

      expect(result.pricePaid).toBe('1000.00');
      expect(result.commissionRateSnapshot).toBe('0.3000');
      expect(result.platformAmount).toBe('300.00');
      expect(result.instructorAmount).toBe('700.00');
      expect(result.walletBalance).toBe('0.00');

      expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('0.00');
      expect((await accountBalance(prisma, instructor.walletAccountId)).toFixed(2)).toBe('700.00');
      expect((await accountBalance(prisma, system.platformRevenueId)).toFixed(2)).toBe('300.00');

      const transaction = await prisma.ledgerTransaction.findUniqueOrThrow({
        where: { id: result.ledgerTransactionId as string },
        include: { entries: true },
      });
      expect(transaction.type).toBe(TxType.PURCHASE);
      expect(transaction.referenceType).toBe('Enrollment');
      expect(transaction.referenceId).toBe(result.enrollmentId);
      expect(transaction.entries).toHaveLength(3);
      expect(
        transaction.entries.filter((entry) => entry.direction === EntryDirection.DEBIT),
      ).toHaveLength(1);

      const enrollment = await prisma.enrollment.findUniqueOrThrow({
        where: { id: result.enrollmentId },
      });
      expect(enrollment.pricePaid.toFixed(2)).toBe('1000.00');
      expect(enrollment.commissionRateSnapshot.toFixed(4)).toBe('0.3000');

      await assertLedgerInvariants(prisma, ledger);
    });

    // Behaviours 3 and 4: prices that do not divide cleanly must still add up.
    const splitCases = [
      {
        price: '999.99',
        rate: '0.3000',
        platform: '300.00',
        instructor: '699.99',
      },
      {
        price: '333.33',
        rate: '0.1500',
        platform: '50.00',
        instructor: '283.33',
      },
      {
        price: '1234.56',
        rate: '0.2500',
        platform: '308.64',
        instructor: '925.92',
      },
      { price: '0.01', rate: '0.3000', platform: '0.00', instructor: '0.01' },
    ];

    it.each(splitCases)(
      'splits $price at rate $rate into $platform + $instructor with nothing lost',
      async ({ price, rate, platform, instructor: instructorShare }) => {
        const seller = await createUser(prisma, {
          role: 'INSTRUCTOR',
          commissionRate: rate,
        });
        const courseId = await createCourse(prisma, {
          instructorId: seller.id,
          categoryId,
          price,
        });
        await fundWallet(prisma, wallet, {
          studentId: student.id,
          adminId: admin.id,
          amount: price,
        });

        const result = await wallet.purchaseCourse(student.id, courseId);

        expect(result.platformAmount).toBe(platform);
        expect(result.instructorAmount).toBe(instructorShare);

        // Invariant 3: the two shares reconstruct the price exactly. Checked
        // in Decimal, never in JS numbers, for the same reason the service is.
        const enrollment = await prisma.enrollment.findUniqueOrThrow({
          where: { id: result.enrollmentId },
        });
        expect(
          enrollment.pricePaid
            .minus(result.platformAmount)
            .minus(result.instructorAmount)
            .toFixed(2),
        ).toBe('0.00');

        expect((await accountBalance(prisma, seller.walletAccountId)).toFixed(2)).toBe(
          instructorShare,
        );
        expect((await accountBalance(prisma, system.platformRevenueId)).toFixed(2)).toBe(platform);
        expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('0.00');

        // A zero share is a legal split but never a legal entry.
        const entryCount = await prisma.ledgerEntry.count({
          where: { transactionId: result.ledgerTransactionId as string },
        });
        expect(entryCount).toBe(platform === '0.00' ? 2 : 3);

        await assertLedgerInvariants(prisma, ledger);
      },
    );

    // Behaviour 8
    it('enrolls in a free course without touching the ledger', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: instructor.id,
        categoryId,
        price: '0.00',
      });

      const result = await wallet.purchaseCourse(student.id, courseId);

      expect(result.pricePaid).toBe('0.00');
      expect(result.platformAmount).toBe('0.00');
      expect(result.instructorAmount).toBe('0.00');
      expect(result.ledgerTransactionId).toBeNull();
      expect(result.commissionRateSnapshot).toBe('0.3000');

      expect(await prisma.enrollment.count()).toBe(1);
      expect(await prisma.ledgerTransaction.count()).toBe(0);
      expect(await prisma.ledgerEntry.count()).toBe(0);
      await assertLedgerInvariants(prisma, ledger);
    });

    // Behaviour 6
    it('rolls everything back when the wallet is short', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: instructor.id,
        categoryId,
        price: '1000.00',
      });
      await fundWallet(prisma, wallet, {
        studentId: student.id,
        adminId: admin.id,
        amount: '999.99',
      });

      await expect(wallet.purchaseCourse(student.id, courseId)).rejects.toBeInstanceOf(
        InsufficientBalanceException,
      );

      expect(await prisma.enrollment.count()).toBe(0);
      // Only the top-up transaction survives; the purchase left no trace.
      expect(await prisma.ledgerTransaction.count()).toBe(1);
      expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('999.99');
      expect((await accountBalance(prisma, instructor.walletAccountId)).toFixed(2)).toBe('0.00');
      expect((await accountBalance(prisma, system.platformRevenueId)).toFixed(2)).toBe('0.00');
      await assertLedgerInvariants(prisma, ledger);
    });

    // Behaviour 7
    it('refuses a course the student already owns', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: instructor.id,
        categoryId,
        price: '500.00',
      });
      await fundWallet(prisma, wallet, {
        studentId: student.id,
        adminId: admin.id,
        amount: '1000.00',
      });
      await wallet.purchaseCourse(student.id, courseId);

      await expect(wallet.purchaseCourse(student.id, courseId)).rejects.toBeInstanceOf(
        AlreadyEnrolledException,
      );

      expect(await prisma.enrollment.count()).toBe(1);
      expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('500.00');
      await assertLedgerInvariants(prisma, ledger);
    });

    // Behaviour 9
    it.each([CourseStatus.DRAFT, CourseStatus.PENDING_REVIEW, CourseStatus.REJECTED])(
      'refuses a course in status %s',
      async (status) => {
        const courseId = await createCourse(prisma, {
          instructorId: instructor.id,
          categoryId,
          price: '500.00',
          status,
        });
        await fundWallet(prisma, wallet, {
          studentId: student.id,
          adminId: admin.id,
          amount: '1000.00',
        });

        await expect(wallet.purchaseCourse(student.id, courseId)).rejects.toBeInstanceOf(
          CourseNotPurchasableException,
        );

        expect(await prisma.enrollment.count()).toBe(0);
        expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('1000.00');
      },
    );

    // Behaviour 10
    it('refuses to let an instructor buy their own course', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: instructor.id,
        categoryId,
        price: '500.00',
      });
      await fundWallet(prisma, wallet, {
        studentId: instructor.id,
        adminId: admin.id,
        amount: '1000.00',
      });

      await expect(wallet.purchaseCourse(instructor.id, courseId)).rejects.toBeInstanceOf(
        CannotBuyOwnCourseException,
      );

      expect(await prisma.enrollment.count()).toBe(0);
      await assertLedgerInvariants(prisma, ledger);
    });

    // Behaviour 12
    it('lets only one of two concurrent purchases through when the money covers one', async () => {
      const firstCourseId = await createCourse(prisma, {
        instructorId: instructor.id,
        categoryId,
        price: '1000.00',
      });
      const secondCourseId = await createCourse(prisma, {
        instructorId: instructor.id,
        categoryId,
        price: '1000.00',
      });
      await fundWallet(prisma, wallet, {
        studentId: student.id,
        adminId: admin.id,
        amount: '1000.00',
      });

      const results = await Promise.allSettled([
        wallet.purchaseCourse(student.id, firstCourseId),
        wallet.purchaseCourse(student.id, secondCourseId),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(InsufficientBalanceException);

      expect(await prisma.enrollment.count()).toBe(1);
      expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('0.00');
      expect((await accountBalance(prisma, instructor.walletAccountId)).toFixed(2)).toBe('700.00');
      await assertLedgerInvariants(prisma, ledger);
    });

    // PLAN.md phase 5: "กดปุ่มซื้อสองครั้งพร้อมกัน → ไม่ถูกตัดเงินซ้ำ"
    it('charges once when the same course is bought twice at the same moment', async () => {
      const courseId = await createCourse(prisma, {
        instructorId: instructor.id,
        categoryId,
        price: '500.00',
      });
      await fundWallet(prisma, wallet, {
        studentId: student.id,
        adminId: admin.id,
        amount: '1000.00',
      });

      const results = await Promise.allSettled([
        wallet.purchaseCourse(student.id, courseId),
        wallet.purchaseCourse(student.id, courseId),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        (results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason,
      ).toBeInstanceOf(AlreadyEnrolledException);

      expect(await prisma.enrollment.count()).toBe(1);
      expect(
        await prisma.ledgerTransaction.count({
          where: { type: TxType.PURCHASE },
        }),
      ).toBe(1);
      expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('500.00');
      await assertLedgerInvariants(prisma, ledger);
    });

    // Behaviour 13
    it('keeps old sales on their original rate after the admin changes it', async () => {
      const firstCourseId = await createCourse(prisma, {
        instructorId: instructor.id,
        categoryId,
        price: '1000.00',
      });
      const secondCourseId = await createCourse(prisma, {
        instructorId: instructor.id,
        categoryId,
        price: '1000.00',
      });
      await fundWallet(prisma, wallet, {
        studentId: student.id,
        adminId: admin.id,
        amount: '2000.00',
      });

      const first = await wallet.purchaseCourse(student.id, firstCourseId);
      expect(first.platformAmount).toBe('300.00');

      // Admin renegotiates the deal, and the instructor raises the price.
      await prisma.user.update({
        where: { id: instructor.id },
        data: { commissionRate: '0.1000' },
      });
      await prisma.course.update({
        where: { id: firstCourseId },
        data: { price: '5000.00' },
      });

      const second = await wallet.purchaseCourse(student.id, secondCourseId);
      expect(second.platformAmount).toBe('100.00');
      expect(second.instructorAmount).toBe('900.00');

      const firstEnrollment = await prisma.enrollment.findUniqueOrThrow({
        where: { id: first.enrollmentId },
      });
      expect(firstEnrollment.commissionRateSnapshot.toFixed(4)).toBe('0.3000');
      expect(firstEnrollment.pricePaid.toFixed(2)).toBe('1000.00');

      expect((await accountBalance(prisma, system.platformRevenueId)).toFixed(2)).toBe('400.00');
      expect((await accountBalance(prisma, instructor.walletAccountId)).toFixed(2)).toBe('1600.00');
      await assertLedgerInvariants(prisma, ledger);
    });
  });

  // -------------------------------------------------------------------------
  // Wallet summary
  // -------------------------------------------------------------------------

  it('reports a wallet history that spans a top-up and a purchase', async () => {
    const courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '1000.00',
      title: 'การปั้นโมเดล Polygon เบื้องต้น',
    });
    await fundWallet(prisma, wallet, {
      studentId: student.id,
      adminId: admin.id,
      amount: '1500.00',
    });
    await wallet.purchaseCourse(student.id, courseId);

    const summary = await ledger.getWalletSummary(student.id);

    expect(summary.balance).toBe('500.00');
    expect(summary.entries).toHaveLength(2);

    const purchase = summary.entries.find((e) => e.type === TxType.PURCHASE);
    expect(purchase?.signedAmount).toBe('-1000.00');
    expect(purchase?.description).toContain('การปั้นโมเดล Polygon เบื้องต้น');

    const topup = summary.entries.find((e) => e.type === TxType.TOPUP);
    expect(topup?.signedAmount).toBe('1500.00');

    // The instructor sees the same sale from the other side.
    const instructorSummary = await ledger.getWalletSummary(instructor.id);
    expect(instructorSummary.balance).toBe('700.00');
    expect(instructorSummary.entries).toHaveLength(1);
    expect(instructorSummary.entries[0].signedAmount).toBe('700.00');

    await assertLedgerInvariants(prisma, ledger);
  });
});
