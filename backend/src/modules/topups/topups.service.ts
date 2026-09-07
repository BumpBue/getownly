import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountKind, Prisma, TopupStatus } from '@prisma/client';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PrismaService } from '@/infra/prisma.service';
import { StorageService } from '@/infra/storage/storage.service';
import type { TopupReviewResultDto } from '@/modules/ledger/dto/ledger-response.dto';
import {
  TopupNotPendingException,
  TopupRequestNotFoundException,
} from '@/modules/ledger/ledger.errors';
import { WalletService } from '@/modules/ledger/wallet.service';
import { maxMbFor, parseObjectKey } from '@/modules/uploads/upload-rules';
import { PromptPayService } from './promptpay.service';
import type {
  AdminListTopupsQueryDto,
  CreateTopupDto,
  ListTopupsQueryDto,
  TopupQuoteRequestDto,
} from './dto/topup-request.dto';
import type {
  AdminTopupRequestDto,
  PaginatedAdminTopupsDto,
  PaginatedTopupsDto,
  TopupQuoteDto,
  TopupRequestDto,
} from './dto/topup-response.dto';
import {
  CannotReviewOwnTopupException,
  InvalidSlipKeyException,
  SlipNotUploadedException,
  SlipTooLargeException,
  TooManyPendingTopupsException,
  TopupAmountOutOfRangeException,
} from './topups.errors';

const DEFAULT_PAGE_SIZE = 10;

/** How many unreviewed requests one person may leave in the queue at once. */
const MAX_PENDING_PER_USER = 5;

const BYTES_PER_MB = 1024 * 1024;

const requestSelect = {
  id: true,
  amount: true,
  status: true,
  note: true,
  slipKey: true,
  reviewedAt: true,
  createdAt: true,
} satisfies Prisma.TopupRequestSelect;

const adminRequestSelect = {
  ...requestSelect,
  studentId: true,
  student: {
    select: {
      id: true,
      displayName: true,
      username: true,
      email: true,
      accounts: {
        where: { kind: AccountKind.USER_WALLET },
        select: { balance: true },
      },
      _count: {
        select: { topupRequests: { where: { status: TopupStatus.APPROVED } } },
      },
    },
  },
  reviewedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.TopupRequestSelect;

type AdminRequestRow = Prisma.TopupRequestGetPayload<{ select: typeof adminRequestSelect }>;

/**
 * Everything around a wallet top-up *except* the money itself.
 *
 * The QR, the slip and the review queue live here; the moment a decision is
 * made the actual posting is handed to {@link WalletService}, which is the only
 * code allowed to move a balance (CLAUDE.md, ข้อห้าม 2).
 */
@Injectable()
export class TopupsService {
  private readonly minAmount: Prisma.Decimal;
  private readonly maxAmount: Prisma.Decimal;
  private readonly maxSlipMb: number;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly promptpay: PromptPayService,
    private readonly wallet: WalletService,
  ) {
    this.minAmount = new Prisma.Decimal(
      this.config.getOrThrow<string | number>('TOPUP_MIN_AMOUNT'),
    );
    this.maxAmount = new Prisma.Decimal(
      this.config.getOrThrow<string | number>('TOPUP_MAX_AMOUNT'),
    );
    // A slip is a photo, so it is measured against the slip ceiling in
    // packages/shared/src/limits.ts, the same one the presign step used.
    this.maxSlipMb = maxMbFor('slip');
  }

  // -------------------------------------------------------------------------
  // Student
  // -------------------------------------------------------------------------

  /**
   * Draws the QR for an amount. Writes nothing: a quote is not a request, and
   * a student may generate as many as they like before deciding to transfer.
   *
   * `async` on purpose even though the body is one call: `parseAmount` throws,
   * and a method typed `Promise<T>` must reject rather than throw before it
   * ever returns one.
   */
  async quote(dto: TopupQuoteRequestDto): Promise<TopupQuoteDto> {
    return this.promptpay.buildQuote(this.parseAmount(dto.amount));
  }

  /**
   * Records "I transferred this much, here is the slip".
   *
   * The amount is what the *student* claims; nothing here believes it. It is
   * shown to an admin next to the slip image, and only their approval turns it
   * into money.
   */
  async create(user: AuthenticatedUser, dto: CreateTopupDto): Promise<TopupRequestDto> {
    const amount = this.parseAmount(dto.amount);
    await this.assertSlipUsable(user, dto.slipKey);

    const pending = await this.prisma.topupRequest.count({
      where: { studentId: user.id, status: TopupStatus.PENDING },
    });
    if (pending >= MAX_PENDING_PER_USER) {
      throw new TooManyPendingTopupsException(MAX_PENDING_PER_USER);
    }

    const request = await this.prisma.topupRequest.create({
      // The requester comes from the token, never from the body (ข้อห้าม 7).
      data: { studentId: user.id, amount, slipKey: dto.slipKey },
      select: requestSelect,
    });

    return this.toRequestDto(request);
  }

  /**
   * Withdraws a request the caller made themselves, before anyone reviewed it.
   *
   * No money has moved yet - a PENDING request never posted a ledger entry -
   * so this is a plain status flip, not a job for WalletService.
   */
  async cancel(topupRequestId: string, user: AuthenticatedUser): Promise<TopupRequestDto> {
    const request = await this.prisma.topupRequest.findUnique({
      where: { id: topupRequestId },
      select: { studentId: true, status: true },
    });

    // Same answer whether the id is wrong or belongs to someone else - a 403
    // here would confirm to the caller that a guessed id exists.
    if (!request || request.studentId !== user.id) {
      throw new TopupRequestNotFoundException();
    }
    if (request.status !== TopupStatus.PENDING) {
      throw new TopupNotPendingException(request.status);
    }

    const cancelled = await this.prisma.topupRequest.update({
      where: { id: topupRequestId },
      data: { status: TopupStatus.CANCELLED },
      select: requestSelect,
    });

    return this.toRequestDto(cancelled);
  }

  /** The student's own history, newest first. */
  async listMine(user: AuthenticatedUser, query: ListTopupsQueryDto): Promise<PaginatedTopupsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.TopupRequestWhereInput = { studentId: user.id };

    const [total, rows] = await Promise.all([
      this.prisma.topupRequest.count({ where }),
      this.prisma.topupRequest.findMany({
        where,
        select: requestSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: await Promise.all(rows.map((row) => this.toRequestDto(row))),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // -------------------------------------------------------------------------
  // Admin review queue
  // -------------------------------------------------------------------------

  async listForAdmin(query: AdminListTopupsQueryDto): Promise<PaginatedAdminTopupsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.TopupRequestWhereInput = query.status ? { status: query.status } : {};

    const [total, pendingTotal, rows] = await Promise.all([
      this.prisma.topupRequest.count({ where }),
      this.prisma.topupRequest.count({ where: { status: TopupStatus.PENDING } }),
      this.prisma.topupRequest.findMany({
        where,
        select: adminRequestSelect,
        // Oldest waiting request first: a review queue is a queue.
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: await Promise.all(rows.map((row) => this.toAdminRequestDto(row))),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      pendingTotal,
    };
  }

  /** Money in. The posting itself belongs to WalletService. */
  async approve(topupRequestId: string, admin: AuthenticatedUser): Promise<TopupReviewResultDto> {
    await this.assertReviewable(topupRequestId, admin);
    return this.wallet.approveTopup(topupRequestId, admin.id);
  }

  /** No money moves, so no ledger transaction is written — only the reason. */
  async reject(
    topupRequestId: string,
    admin: AuthenticatedUser,
    note: string,
  ): Promise<TopupReviewResultDto> {
    await this.assertReviewable(topupRequestId, admin);
    return this.wallet.rejectTopup(topupRequestId, admin.id, note);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Refuses a self-review before handing over.
   *
   * The row is read outside the lock WalletService takes, so this is a policy
   * check rather than a race-proof one — which is all it needs to be, because
   * the identity it compares cannot change mid-request.
   */
  private async assertReviewable(topupRequestId: string, admin: AuthenticatedUser): Promise<void> {
    const request = await this.prisma.topupRequest.findUnique({
      where: { id: topupRequestId },
      select: { studentId: true },
    });

    if (!request) {
      throw new TopupRequestNotFoundException();
    }
    if (request.studentId === admin.id) {
      throw new CannotReviewOwnTopupException();
    }
  }

  private parseAmount(raw: string): Prisma.Decimal {
    const amount = new Prisma.Decimal(raw);

    if (amount.lessThan(this.minAmount) || amount.greaterThan(this.maxAmount)) {
      throw new TopupAmountOutOfRangeException(
        this.minAmount.toFixed(0),
        this.maxAmount.toFixed(0),
      );
    }

    return amount;
  }

  /**
   * Proves the slip is a real object this user just uploaded.
   *
   * The size is read from MinIO rather than taken from the request, for the
   * same reason lesson materials are: at presign time the API can only check
   * what the client *claims* it will upload, and the same URL accepts anything
   * afterwards.
   */
  private async assertSlipUsable(user: AuthenticatedUser, slipKey: string): Promise<void> {
    const parsed = parseObjectKey(slipKey);
    if (!parsed || parsed.kind !== 'slip' || parsed.ownerId !== user.id) {
      throw new InvalidSlipKeyException();
    }

    const stored = await this.storage.stat(slipKey);
    if (!stored) {
      throw new SlipNotUploadedException();
    }
    if (stored.sizeBytes > this.maxSlipMb * BYTES_PER_MB) {
      throw new SlipTooLargeException(this.maxSlipMb, stored.sizeBytes);
    }
  }

  private async toRequestDto(
    row: Prisma.TopupRequestGetPayload<{ select: typeof requestSelect }>,
  ): Promise<TopupRequestDto> {
    return {
      id: row.id,
      amount: row.amount.toFixed(2),
      status: row.status,
      note: row.note,
      slipUrl: await this.storage.presignGetOrNull(row.slipKey),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async toAdminRequestDto(row: AdminRequestRow): Promise<AdminTopupRequestDto> {
    return {
      ...(await this.toRequestDto(row)),
      student: {
        id: row.student.id,
        displayName: row.student.displayName,
        username: row.student.username,
        // An admin reviewing a transfer needs to be able to identify the payer;
        // this is the one response where another user's email is on purpose.
        email: row.student.email,
      },
      studentWalletBalance: (row.student.accounts[0]?.balance ?? new Prisma.Decimal(0)).toFixed(2),
      studentApprovedCount: row.student._count.topupRequests,
      reviewedBy: row.reviewedBy,
    };
  }
}
