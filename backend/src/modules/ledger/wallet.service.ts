import { Injectable } from '@nestjs/common';
import {
  AccountKind,
  CourseStatus,
  EntryDirection,
  Prisma,
  TopupStatus,
  TxType,
} from '@prisma/client';
import { PrismaService } from '@/infra/prisma.service';
import { LedgerService, ZERO } from './ledger.service';
import {
  AlreadyEnrolledException,
  CannotBuyOwnCourseException,
  CourseNotFoundException,
  CourseNotPurchasableException,
  InsufficientBalanceException,
  TopupNotPendingException,
  TopupRejectNoteRequiredException,
  TopupRequestNotFoundException,
} from './ledger.errors';
import type { PurchaseResultDto, TopupReviewResultDto } from './dto/ledger-response.dto';

/**
 * Long enough that a purchase can wait behind another purchase holding the
 * same wallet lock, short enough that a stuck transaction still gives up.
 */
const MONEY_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 15_000,
} as const;

interface LockedTopupRow {
  id: string;
  studentId: string;
  amount: string;
  status: string;
}

/**
 * The money flows a user can trigger: topping a wallet up, and spending it.
 *
 * Every method here opens exactly one `prisma.$transaction` and delegates the
 * accounting itself to {@link LedgerService}. Nothing in this file updates a
 * balance without a matching pair of ledger entries.
 */
@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /**
   * An admin has eyeballed the transfer slip and accepted it.
   * Money enters the platform: EXTERNAL_BANK is debited, the wallet credited.
   */
  async approveTopup(topupRequestId: string, adminId: string): Promise<TopupReviewResultDto> {
    return this.prisma.$transaction(async (tx) => {
      const request = await lockTopupRequest(tx, topupRequestId);
      const amount = new Prisma.Decimal(request.amount);

      const [walletAccountId, bankAccountId] = await Promise.all([
        this.ledger.getWalletAccountId(request.studentId, tx),
        this.ledger.getSystemAccountId(AccountKind.EXTERNAL_BANK, tx),
      ]);

      const balances = await this.ledger.lockAccounts(tx, [walletAccountId, bankAccountId]);
      const balanceBefore = balances.get(walletAccountId) ?? ZERO;

      const reviewedAt = new Date();
      await tx.topupRequest.update({
        where: { id: topupRequestId },
        data: {
          status: TopupStatus.APPROVED,
          reviewedById: adminId,
          reviewedAt,
        },
      });

      const ledgerTransactionId = await this.ledger.postTransaction(tx, {
        type: TxType.TOPUP,
        idempotencyKey: `topup:${topupRequestId}`,
        referenceType: 'TopupRequest',
        referenceId: topupRequestId,
        description: `เติมเงินเข้ากระเป๋า ${amount.toFixed(2)} บาท`,
        entries: [
          {
            accountId: bankAccountId,
            direction: EntryDirection.DEBIT,
            amount,
          },
          {
            accountId: walletAccountId,
            direction: EntryDirection.CREDIT,
            amount,
          },
        ],
      });

      return {
        topupRequestId,
        status: TopupStatus.APPROVED,
        amount: amount.toFixed(2),
        reviewedById: adminId,
        reviewedAt: reviewedAt.toISOString(),
        ledgerTransactionId,
        walletBalance: balanceBefore.plus(amount).toFixed(2),
      };
    }, MONEY_TRANSACTION_OPTIONS);
  }

  /**
   * The slip did not check out. No money moves, so no ledger transaction is
   * written — only the request status and the reason change.
   */
  async rejectTopup(
    topupRequestId: string,
    adminId: string,
    note: string,
  ): Promise<TopupReviewResultDto> {
    const reason = note.trim();
    if (reason.length === 0) {
      throw new TopupRejectNoteRequiredException();
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await lockTopupRequest(tx, topupRequestId);
      const amount = new Prisma.Decimal(request.amount);

      const reviewedAt = new Date();
      await tx.topupRequest.update({
        where: { id: topupRequestId },
        data: {
          status: TopupStatus.REJECTED,
          reviewedById: adminId,
          reviewedAt,
          note: reason,
        },
      });

      const walletAccountId = await this.ledger.getWalletAccountId(request.studentId, tx);
      const wallet = await tx.account.findUniqueOrThrow({
        where: { id: walletAccountId },
        select: { balance: true },
      });

      return {
        topupRequestId,
        status: TopupStatus.REJECTED,
        amount: amount.toFixed(2),
        reviewedById: adminId,
        reviewedAt: reviewedAt.toISOString(),
        ledgerTransactionId: null,
        walletBalance: wallet.balance.toFixed(2),
      };
    }, MONEY_TRANSACTION_OPTIONS);
  }

  /**
   * Buys a course with wallet money.
   *
   * The price and the instructor's commission rate are snapshotted onto the
   * enrollment, because both can be edited later and old reports must not move
   * (see CLAUDE.md, "Snapshot").
   */
  async purchaseCourse(studentId: string, courseId: string): Promise<PurchaseResultDto> {
    return this.prisma.$transaction(async (tx) => {
      const course = await tx.course.findUnique({
        where: { id: courseId },
        select: {
          id: true,
          title: true,
          price: true,
          status: true,
          instructorId: true,
          instructor: { select: { commissionRate: true } },
        },
      });

      if (!course) {
        throw new CourseNotFoundException();
      }
      if (course.status !== CourseStatus.PUBLISHED) {
        throw new CourseNotPurchasableException(course.status);
      }
      if (course.instructorId === studentId) {
        throw new CannotBuyOwnCourseException();
      }

      // Fast path. Two purchases racing each other both pass this check, so
      // the unique index on (courseId, studentId) is what actually decides;
      // createEnrollment below turns that collision into the same error.
      const existing = await tx.enrollment.findUnique({
        where: { courseId_studentId: { courseId, studentId } },
        select: { id: true },
      });
      if (existing) {
        throw new AlreadyEnrolledException();
      }

      const price = course.price;
      const commissionRate = course.instructor.commissionRate;
      const studentWalletId = await this.ledger.getWalletAccountId(studentId, tx);

      // Free course: an enrollment is created, but no money exists to record.
      if (price.lessThanOrEqualTo(ZERO)) {
        const enrollment = await createEnrollment(tx, {
          courseId,
          studentId,
          pricePaid: ZERO,
          commissionRateSnapshot: commissionRate,
        });

        const wallet = await tx.account.findUniqueOrThrow({
          where: { id: studentWalletId },
          select: { balance: true },
        });

        return {
          enrollmentId: enrollment.id,
          courseId,
          courseTitle: course.title,
          instructorId: course.instructorId,
          pricePaid: ZERO.toFixed(2),
          commissionRateSnapshot: commissionRate.toFixed(4),
          platformAmount: ZERO.toFixed(2),
          instructorAmount: ZERO.toFixed(2),
          ledgerTransactionId: null,
          walletBalance: wallet.balance.toFixed(2),
        };
      }

      const [instructorWalletId, platformRevenueId] = await Promise.all([
        this.ledger.getWalletAccountId(course.instructorId, tx),
        this.ledger.getSystemAccountId(AccountKind.PLATFORM_REVENUE, tx),
      ]);

      const balances = await this.ledger.lockAccounts(tx, [
        studentWalletId,
        instructorWalletId,
        platformRevenueId,
      ]);
      const balanceBefore = balances.get(studentWalletId) ?? ZERO;

      if (balanceBefore.lessThan(price)) {
        throw new InsufficientBalanceException(price.toFixed(2), balanceBefore.toFixed(2));
      }

      // Round the platform's cut, then derive the instructor's share by
      // subtraction so the two always add back up to the price exactly.
      const platformAmount = price
        .mul(commissionRate)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const instructorAmount = price.minus(platformAmount);

      const enrollment = await createEnrollment(tx, {
        courseId,
        studentId,
        pricePaid: price,
        commissionRateSnapshot: commissionRate,
      });

      const entries = [
        {
          accountId: studentWalletId,
          direction: EntryDirection.DEBIT,
          amount: price,
        },
        {
          accountId: instructorWalletId,
          direction: EntryDirection.CREDIT,
          amount: instructorAmount,
        },
        {
          accountId: platformRevenueId,
          direction: EntryDirection.CREDIT,
          amount: platformAmount,
        },
        // A zero platform cut (a 0.01 baht course, say) is a legal split but
        // not a legal entry, so it is left out rather than written as 0.00.
      ].filter((entry) => entry.amount.greaterThan(ZERO));

      const ledgerTransactionId = await this.ledger.postTransaction(tx, {
        type: TxType.PURCHASE,
        idempotencyKey: `purchase:${enrollment.id}`,
        referenceType: 'Enrollment',
        referenceId: enrollment.id,
        description: `ซื้อคอร์ส "${course.title}"`,
        entries,
      });

      return {
        enrollmentId: enrollment.id,
        courseId,
        courseTitle: course.title,
        instructorId: course.instructorId,
        pricePaid: price.toFixed(2),
        commissionRateSnapshot: commissionRate.toFixed(4),
        platformAmount: platformAmount.toFixed(2),
        instructorAmount: instructorAmount.toFixed(2),
        ledgerTransactionId,
        walletBalance: balanceBefore.minus(price).toFixed(2),
      };
    }, MONEY_TRANSACTION_OPTIONS);
  }
}

/**
 * Creates the enrollment, translating the unique-index collision that a
 * concurrent purchase of the same course produces into the error the client
 * would have got had it arrived a moment later.
 */
async function createEnrollment(
  tx: Prisma.TransactionClient,
  data: {
    courseId: string;
    studentId: string;
    pricePaid: Prisma.Decimal;
    commissionRateSnapshot: Prisma.Decimal;
  },
): Promise<{ id: string }> {
  try {
    return await tx.enrollment.create({ data, select: { id: true } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AlreadyEnrolledException();
    }
    throw error;
  }
}

/**
 * Locks the request row first, so two admins clicking approve at the same
 * moment are serialised and the second one sees the status the first wrote.
 */
async function lockTopupRequest(
  tx: Prisma.TransactionClient,
  topupRequestId: string,
): Promise<LockedTopupRow> {
  const rows = await tx.$queryRaw<LockedTopupRow[]>`
    SELECT id, "studentId", amount::text AS amount, status::text AS status
    FROM "TopupRequest"
    WHERE id = ${topupRequestId}
    FOR UPDATE
  `;

  const request = rows[0];
  if (!request) {
    throw new TopupRequestNotFoundException();
  }
  if (request.status !== TopupStatus.PENDING) {
    throw new TopupNotPendingException(request.status);
  }

  return request;
}
