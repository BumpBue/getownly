import { Injectable } from '@nestjs/common';
import { AccountKind, PayoutStatus, Prisma } from '@prisma/client';
import { PAYOUT_MIN_AMOUNT_BAHT } from '@getownly/shared';
import { maskAccountNumber } from '@/common/bank-account';
import { PrismaService } from '@/infra/prisma.service';
import { WalletService } from '@/modules/ledger/wallet.service';
import type {
  AdminListPayoutsQueryDto,
  CreatePayoutDto,
  ListPayoutsQueryDto,
  SaveBankAccountDto,
} from './dto/payout-request.dto';
import type {
  AdminPayoutListItemDto,
  AdminPayoutRequestDto,
  BankAccountDto,
  MaskedBankAccountDto,
  PaginatedAdminPayoutsDto,
  PaginatedPayoutsDto,
  PayoutOverviewDto,
  PayoutRequestDto,
  PayoutReviewResultDto,
} from './dto/payout-response.dto';
import {
  BankAccountRequiredException,
  CannotReviewOwnPayoutException,
  PayoutAmountBelowMinimumException,
  PayoutRequestNotFoundException,
} from './payouts.errors';

const DEFAULT_PAGE_SIZE = 10;

const requestSelect = {
  id: true,
  amount: true,
  status: true,
  bankName: true,
  accountName: true,
  accountNumber: true,
  note: true,
  reviewedAt: true,
  createdAt: true,
} satisfies Prisma.PayoutRequestSelect;

const adminRequestSelect = {
  ...requestSelect,
  instructorId: true,
  instructor: {
    select: {
      id: true,
      displayName: true,
      accounts: {
        where: { kind: AccountKind.USER_WALLET },
        select: { balance: true },
      },
    },
  },
  reviewedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.PayoutRequestSelect;

type RequestRow = Prisma.PayoutRequestGetPayload<{ select: typeof requestSelect }>;
type AdminRequestRow = Prisma.PayoutRequestGetPayload<{ select: typeof adminRequestSelect }>;

/**
 * Everything around an instructor withdrawal *except* the money itself.
 *
 * The bank details, the request lifecycle and the review queue live here; the
 * moment money has to move it is handed to {@link WalletService}, which is the
 * only code allowed to touch a balance (CLAUDE.md, ข้อห้าม 2).
 *
 * The shape deliberately mirrors {@link TopupsService}: a request row, a status,
 * an admin queue, approve or reject with a note. It shares no code with it,
 * because the two carry different data — a top-up has a slip and no bank
 * details, a payout the reverse — and because an account number that an admin
 * may read must never be reachable from a query written for the other queue.
 */
@Injectable()
export class PayoutsService {
  private readonly minimumAmount: Prisma.Decimal;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {
    this.minimumAmount = new Prisma.Decimal(PAYOUT_MIN_AMOUNT_BAHT);
  }

  // -------------------------------------------------------------------------
  // Instructor: bank details
  // -------------------------------------------------------------------------

  /**
   * The instructor's own bank details, unmasked.
   *
   * One of exactly two places in the API that returns the full number, and the
   * only one an instructor can reach: it fills in the form where they edit it,
   * so a correction does not mean retyping from memory.
   */
  async readBankAccount(instructorId: string): Promise<BankAccountDto | null> {
    const account = await this.prisma.instructorBankAccount.findUnique({
      where: { instructorId },
      select: { bankName: true, accountName: true, accountNumber: true, updatedAt: true },
    });

    if (!account) {
      return null;
    }

    return {
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  /**
   * Saves the details. Requests already made keep their own snapshot, so
   * correcting an account never rewrites where a past transfer went.
   */
  async saveBankAccount(instructorId: string, dto: SaveBankAccountDto): Promise<BankAccountDto> {
    const account = await this.prisma.instructorBankAccount.upsert({
      where: { instructorId },
      create: { instructorId, ...dto },
      update: dto,
      select: { bankName: true, accountName: true, accountNumber: true, updatedAt: true },
    });

    return {
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Instructor: requests
  // -------------------------------------------------------------------------

  /** Everything the withdrawal page shows above the history table. */
  async overview(instructorId: string): Promise<PayoutOverviewDto> {
    const [wallet, bankAccount, pending] = await Promise.all([
      this.prisma.account.findFirst({
        where: { ownerId: instructorId, kind: AccountKind.USER_WALLET },
        select: { balance: true },
      }),
      this.prisma.instructorBankAccount.findUnique({
        where: { instructorId },
        select: { bankName: true, accountName: true, accountNumber: true },
      }),
      this.prisma.payoutRequest.findFirst({
        where: { instructorId, status: PayoutStatus.PENDING },
        select: requestSelect,
      }),
    ]);

    const balance = wallet?.balance ?? new Prisma.Decimal(0);

    return {
      // The same number, twice, on purpose: a pending request has already left
      // the wallet, so there is no second figure to reconcile. Both are sent so
      // the page can say so rather than leave the reader to assume it.
      walletBalance: balance.toFixed(2),
      withdrawableAmount: balance.toFixed(2),
      pendingAmount: (pending?.amount ?? new Prisma.Decimal(0)).toFixed(2),
      minimumAmount: this.minimumAmount.toFixed(2),
      bankAccount: bankAccount ? toMaskedBankAccount(bankAccount) : null,
      pendingRequest: pending ? toRequestDto(pending) : null,
    };
  }

  /**
   * Asks to withdraw.
   *
   * The floor is checked here because it is a fixed rule; whether the wallet
   * actually holds the money is decided by WalletService, after the account row
   * is locked. Checking a balance before the lock would be checking a number
   * that can still change.
   */
  async create(instructorId: string, dto: CreatePayoutDto): Promise<PayoutReviewResultDto> {
    const amount = new Prisma.Decimal(dto.amount);

    if (amount.lessThan(this.minimumAmount)) {
      throw new PayoutAmountBelowMinimumException(this.minimumAmount.toFixed(2), amount.toFixed(2));
    }

    const bank = await this.prisma.instructorBankAccount.findUnique({
      where: { instructorId },
      select: { bankName: true, accountName: true, accountNumber: true },
    });

    if (!bank) {
      throw new BankAccountRequiredException();
    }

    // Snapshotted onto the request, because the instructor may correct their
    // account afterwards and a transfer has to keep saying where it went.
    return this.wallet.requestPayout(instructorId, amount, bank);
  }

  /** The instructor's own history, newest first. */
  async listMine(instructorId: string, query: ListPayoutsQueryDto): Promise<PaginatedPayoutsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const [total, rows] = await Promise.all([
      this.prisma.payoutRequest.count({ where: { instructorId } }),
      this.prisma.payoutRequest.findMany({
        where: { instructorId },
        // `id` breaks ties, so two requests made in the same millisecond
        // cannot swap places between pages.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: requestSelect,
      }),
    ]);

    return {
      items: rows.map(toRequestDto),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** Changed their mind, before anybody reviewed it. */
  async cancel(payoutRequestId: string, instructorId: string): Promise<PayoutReviewResultDto> {
    return this.wallet.cancelPayout(payoutRequestId, instructorId);
  }

  // -------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------

  async listForAdmin(query: AdminListPayoutsQueryDto): Promise<PaginatedAdminPayoutsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where = query.status ? { status: query.status } : {};

    const [total, rows, pendingTotal, held] = await Promise.all([
      this.prisma.payoutRequest.count({ where }),
      this.prisma.payoutRequest.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: adminRequestSelect,
      }),
      this.prisma.payoutRequest.count({ where: { status: PayoutStatus.PENDING } }),
      // Read from the holding account rather than by summing the requests:
      // the ledger is what actually says how much is set aside.
      this.prisma.account.findFirst({
        where: { ownerId: null, kind: AccountKind.PAYOUT_PAYABLE },
        select: { balance: true },
      }),
    ]);

    return {
      items: rows.map(toAdminListItemDto),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      pendingTotal,
      pendingAmountTotal: (held?.balance ?? new Prisma.Decimal(0)).toFixed(2),
    };
  }

  /** One request, with the full account number to transfer to. */
  async readForAdmin(payoutRequestId: string): Promise<AdminPayoutRequestDto> {
    const row = await this.prisma.payoutRequest.findUnique({
      where: { id: payoutRequestId },
      select: adminRequestSelect,
    });

    if (!row) {
      throw new PayoutRequestNotFoundException();
    }

    return toAdminRequestDto(row);
  }

  async approve(payoutRequestId: string, adminId: string): Promise<PayoutReviewResultDto> {
    await this.assertNotOwnRequest(payoutRequestId, adminId);
    return this.wallet.approvePayout(payoutRequestId, adminId);
  }

  async reject(
    payoutRequestId: string,
    adminId: string,
    note: string,
  ): Promise<PayoutReviewResultDto> {
    await this.assertNotOwnRequest(payoutRequestId, adminId);
    return this.wallet.rejectPayout(payoutRequestId, adminId, note);
  }

  /**
   * An admin cannot review a request of their own.
   *
   * Unreachable through the interface — an admin has no instructor wallet to
   * withdraw from — but roles can be changed, and the money path should not
   * depend on that never happening. The same guard the top-up queue has.
   */
  private async assertNotOwnRequest(payoutRequestId: string, adminId: string): Promise<void> {
    const row = await this.prisma.payoutRequest.findUnique({
      where: { id: payoutRequestId },
      select: { instructorId: true },
    });

    if (!row) {
      throw new PayoutRequestNotFoundException();
    }
    if (row.instructorId === adminId) {
      throw new CannotReviewOwnPayoutException();
    }
  }
}

function toMaskedBankAccount(bank: {
  bankName: string;
  accountName: string;
  accountNumber: string;
}): MaskedBankAccountDto {
  return {
    bankName: bank.bankName,
    accountName: bank.accountName,
    accountNumberMasked: maskAccountNumber(bank.accountNumber),
  };
}

/**
 * The owner's view of their own request.
 *
 * Masked even here: the instructor knows their own account number, and a
 * history table is a screen other people look over your shoulder at. The
 * unmasked value lives only on the form where it is edited.
 */
function toRequestDto(row: RequestRow): PayoutRequestDto {
  return {
    id: row.id,
    amount: row.amount.toFixed(2),
    status: row.status,
    bankAccount: toMaskedBankAccount(row),
    note: row.note,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * A queue row, masked like everywhere else.
 *
 * The account number is left out by construction rather than deleted
 * afterwards: `toAdminListItemDto` never names the field, so a future edit to
 * the shared part below cannot accidentally put it back.
 */
function toAdminListItemDto(row: AdminRequestRow): AdminPayoutListItemDto {
  return {
    ...adminRowBody(row),
    accountNumberMasked: maskAccountNumber(row.accountNumber),
  };
}

/** The opened request. The one admin payload that carries the number in full. */
function toAdminRequestDto(row: AdminRequestRow): AdminPayoutRequestDto {
  return {
    ...adminRowBody(row),
    accountNumber: row.accountNumber,
  };
}

/** Everything both admin views share, which is everything but the number. */
function adminRowBody(row: AdminRequestRow): Omit<AdminPayoutRequestDto, 'accountNumber'> {
  return {
    id: row.id,
    amount: row.amount.toFixed(2),
    status: row.status,
    instructor: {
      id: row.instructor.id,
      displayName: row.instructor.displayName,
      walletBalance: (row.instructor.accounts[0]?.balance ?? new Prisma.Decimal(0)).toFixed(2),
    },
    bankName: row.bankName,
    accountName: row.accountName,
    note: row.note,
    reviewedBy: row.reviewedBy
      ? { id: row.reviewedBy.id, displayName: row.reviewedBy.displayName }
      : null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
