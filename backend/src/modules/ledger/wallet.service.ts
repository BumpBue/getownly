import { Injectable } from '@nestjs/common';
import {
  AccountKind,
  CourseStatus,
  EntryDirection,
  PayoutStatus,
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
import {
  NotPayoutOwnerException,
  PayoutAlreadyPendingException,
  PayoutExceedsBalanceException,
  PayoutNotPendingException,
  PayoutRequestNotFoundException,
} from '@/modules/payouts/payouts.errors';
import type { PayoutReviewResultDto } from '@/modules/payouts/dto/payout-response.dto';
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

interface LockedPayoutRow {
  id: string;
  instructorId: string;
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

  // -------------------------------------------------------------------------
  // Payouts
  //
  // Three movements, one request. Money leaves the wallet when the instructor
  // asks, waits in PAYOUT_PAYABLE while somebody looks at it, and then either
  // leaves the platform or comes back. Nothing is ever edited to undo a step:
  // the way back is another balanced transaction (CLAUDE.md, ข้อห้าม 5).
  // -------------------------------------------------------------------------

  /**
   * The instructor asks to withdraw. The money moves immediately.
   *
   * Debiting here rather than at approval is the whole point of the design:
   * `Account.balance` is then always what the instructor can actually spend or
   * withdraw, and the same baht can never be both requested and used to buy a
   * course. It costs a holding account and a reversal on refusal; it buys a
   * wallet balance that never needs explaining.
   */
  async requestPayout(
    instructorId: string,
    amount: Prisma.Decimal,
    bank: { bankCode: string; bankName: string; accountName: string; accountNumber: string },
  ): Promise<PayoutReviewResultDto> {
    return this.prisma.$transaction(async (tx) => {
      const [walletAccountId, payableAccountId] = await Promise.all([
        this.ledger.getWalletAccountId(instructorId, tx),
        this.ledger.getSystemAccountId(AccountKind.PAYOUT_PAYABLE, tx),
      ]);

      // Read the balance only from what the lock returned, exactly as
      // purchaseCourse does: anything read before the lock is a guess.
      const balances = await this.ledger.lockAccounts(tx, [walletAccountId, payableAccountId]);
      const balanceBefore = balances.get(walletAccountId) ?? ZERO;

      if (balanceBefore.lessThan(amount)) {
        throw new PayoutExceedsBalanceException(balanceBefore.toFixed(2), amount.toFixed(2));
      }

      const request = await createPayoutRequest(tx, { instructorId, amount, ...bank });

      const ledgerTransactionId = await this.ledger.postTransaction(tx, {
        type: TxType.PAYOUT,
        idempotencyKey: `payout:${request.id}`,
        referenceType: 'PayoutRequest',
        referenceId: request.id,
        description: `ยื่นขอถอนเงิน ${amount.toFixed(2)} บาท`,
        entries: [
          { accountId: walletAccountId, direction: EntryDirection.DEBIT, amount },
          { accountId: payableAccountId, direction: EntryDirection.CREDIT, amount },
        ],
      });

      return {
        payoutRequestId: request.id,
        status: PayoutStatus.PENDING,
        amount: amount.toFixed(2),
        reviewedById: null,
        reviewedAt: null,
        ledgerTransactionId,
        walletBalance: balanceBefore.minus(amount).toFixed(2),
      };
    }, MONEY_TRANSACTION_OPTIONS);
  }

  /**
   * An admin has made the transfer and is recording it. The money leaves.
   *
   * The wallet is not touched: it was debited when the request was made, so
   * this moves the held amount out to EXTERNAL_BANK, walking that account back
   * toward the zero it started at.
   *
   * `referenceType` is what tells this transaction apart from the other two a
   * request can produce, and it is how the reports know that these baht are
   * settled rather than merely requested.
   */
  async approvePayout(payoutRequestId: string, adminId: string): Promise<PayoutReviewResultDto> {
    return this.prisma.$transaction(async (tx) => {
      const request = await lockPayoutRequest(tx, payoutRequestId);
      const amount = new Prisma.Decimal(request.amount);

      const [walletAccountId, payableAccountId, bankAccountId] = await Promise.all([
        this.ledger.getWalletAccountId(request.instructorId, tx),
        this.ledger.getSystemAccountId(AccountKind.PAYOUT_PAYABLE, tx),
        this.ledger.getSystemAccountId(AccountKind.EXTERNAL_BANK, tx),
      ]);

      const balances = await this.ledger.lockAccounts(tx, [
        walletAccountId,
        payableAccountId,
        bankAccountId,
      ]);

      const reviewedAt = new Date();
      await tx.payoutRequest.update({
        where: { id: payoutRequestId },
        data: { status: PayoutStatus.APPROVED, reviewedById: adminId, reviewedAt },
      });

      const ledgerTransactionId = await this.ledger.postTransaction(tx, {
        type: TxType.PAYOUT,
        idempotencyKey: `payout-settle:${payoutRequestId}`,
        referenceType: 'PayoutSettlement',
        referenceId: payoutRequestId,
        description: `โอนเงินถอน ${amount.toFixed(2)} บาท ออกจากระบบ`,
        entries: [
          { accountId: payableAccountId, direction: EntryDirection.DEBIT, amount },
          { accountId: bankAccountId, direction: EntryDirection.CREDIT, amount },
        ],
      });

      return {
        payoutRequestId,
        status: PayoutStatus.APPROVED,
        amount: amount.toFixed(2),
        reviewedById: adminId,
        reviewedAt: reviewedAt.toISOString(),
        ledgerTransactionId,
        // Unchanged: this money left the wallet when the request was made.
        walletBalance: (balances.get(walletAccountId) ?? ZERO).toFixed(2),
      };
    }, MONEY_TRANSACTION_OPTIONS);
  }

  /** An admin refuses the request. The held money goes back to the wallet. */
  async rejectPayout(
    payoutRequestId: string,
    adminId: string,
    note: string,
  ): Promise<PayoutReviewResultDto> {
    return this.releasePayout(payoutRequestId, {
      status: PayoutStatus.REJECTED,
      reviewedById: adminId,
      note,
      description: 'คืนเงินจากคำขอถอนที่ถูกปฏิเสธ',
    });
  }

  /** The instructor changes their mind. Same movement, different reason. */
  async cancelPayout(
    payoutRequestId: string,
    instructorId: string,
  ): Promise<PayoutReviewResultDto> {
    return this.releasePayout(payoutRequestId, {
      status: PayoutStatus.CANCELLED,
      reviewedById: null,
      note: null,
      description: 'คืนเงินจากคำขอถอนที่ยกเลิกเอง',
      requireOwner: instructorId,
    });
  }

  /**
   * The way back, shared by refusal and cancellation.
   *
   * One transaction, one reason to exist: whichever way a pending request
   * ends without a transfer, the held baht return to the wallet they came
   * from. Writing it once means the two endings can never drift into moving
   * different amounts.
   */
  private async releasePayout(
    payoutRequestId: string,
    options: {
      status: typeof PayoutStatus.REJECTED | typeof PayoutStatus.CANCELLED;
      reviewedById: string | null;
      note: string | null;
      description: string;
      /** When set, the row must belong to this user or the caller gets 403. */
      requireOwner?: string;
    },
  ): Promise<PayoutReviewResultDto> {
    return this.prisma.$transaction(async (tx) => {
      const request = await lockPayoutRequest(tx, payoutRequestId, options.requireOwner);
      const amount = new Prisma.Decimal(request.amount);

      const [walletAccountId, payableAccountId] = await Promise.all([
        this.ledger.getWalletAccountId(request.instructorId, tx),
        this.ledger.getSystemAccountId(AccountKind.PAYOUT_PAYABLE, tx),
      ]);

      const balances = await this.ledger.lockAccounts(tx, [walletAccountId, payableAccountId]);
      const balanceBefore = balances.get(walletAccountId) ?? ZERO;

      const reviewedAt = new Date();
      await tx.payoutRequest.update({
        where: { id: payoutRequestId },
        data: {
          status: options.status,
          reviewedById: options.reviewedById,
          reviewedAt,
          note: options.note,
        },
      });

      const ledgerTransactionId = await this.ledger.postTransaction(tx, {
        type: TxType.PAYOUT,
        idempotencyKey: `payout-reversal:${payoutRequestId}`,
        referenceType: 'PayoutReversal',
        referenceId: payoutRequestId,
        description: `${options.description} ${amount.toFixed(2)} บาท`,
        entries: [
          { accountId: payableAccountId, direction: EntryDirection.DEBIT, amount },
          { accountId: walletAccountId, direction: EntryDirection.CREDIT, amount },
        ],
      });

      return {
        payoutRequestId,
        status: options.status,
        amount: amount.toFixed(2),
        reviewedById: options.reviewedById,
        reviewedAt: reviewedAt.toISOString(),
        ledgerTransactionId,
        walletBalance: balanceBefore.plus(amount).toFixed(2),
      };
    }, MONEY_TRANSACTION_OPTIONS);
  }
}

/**
 * Creates the request row, translating the partial unique index on pending
 * requests into the error the instructor would have got had their second
 * submission arrived a moment later.
 */
async function createPayoutRequest(
  tx: Prisma.TransactionClient,
  data: {
    instructorId: string;
    amount: Prisma.Decimal;
    bankCode: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
  },
): Promise<{ id: string }> {
  try {
    return await tx.payoutRequest.create({ data, select: { id: true } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new PayoutAlreadyPendingException(data.amount.toFixed(2));
    }
    throw error;
  }
}

/**
 * Locks the request row first, so two admins clicking approve at the same
 * moment are serialised and the second one sees the status the first wrote.
 *
 * `requireOwner` is checked here rather than in the caller because the answer
 * has to come from the locked row: reading ownership before the lock would be
 * reading a row that could still change.
 */
async function lockPayoutRequest(
  tx: Prisma.TransactionClient,
  payoutRequestId: string,
  requireOwner?: string,
): Promise<LockedPayoutRow> {
  const rows = await tx.$queryRaw<LockedPayoutRow[]>`
    SELECT id, "instructorId", amount::text AS amount, status::text AS status
    FROM "PayoutRequest"
    WHERE id = ${payoutRequestId}
    FOR UPDATE
  `;

  const request = rows[0];
  if (!request) {
    throw new PayoutRequestNotFoundException();
  }
  if (requireOwner && request.instructorId !== requireOwner) {
    throw new NotPayoutOwnerException();
  }
  if (request.status !== PayoutStatus.PENDING) {
    throw new PayoutNotPendingException(request.status);
  }

  return request;
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
