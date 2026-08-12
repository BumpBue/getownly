import { EntryDirection, TopupStatus, TxType } from '@prisma/client';

/**
 * Money always leaves a service as a fixed-point string such as "1250.00",
 * never as a JS number (see CLAUDE.md, "เรื่องเงิน").
 */
export type MoneyString = string;

export interface WalletEntryDto {
  entryId: string;
  transactionId: string;
  type: TxType;
  description: string;
  direction: EntryDirection;
  /** Always positive. */
  amount: MoneyString;
  /** Negative when money left the wallet, positive when it came in. */
  signedAmount: MoneyString;
  createdAt: string;
}

export interface WalletSummaryDto {
  userId: string;
  accountId: string;
  balance: MoneyString;
  entries: WalletEntryDto[];
}

/** What GET /wallet returns: the headline number plus one page of movements. */
export interface WalletPageDto {
  balance: MoneyString;
  entries: WalletEntryDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TopupReviewResultDto {
  topupRequestId: string;
  status: TopupStatus;
  amount: MoneyString;
  reviewedById: string;
  reviewedAt: string;
  /** null when the request was rejected, because nothing is posted then. */
  ledgerTransactionId: string | null;
  /** Wallet balance of the requester after the review. */
  walletBalance: MoneyString;
}

export interface PurchaseResultDto {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  instructorId: string;
  /** Snapshot of what was actually charged. */
  pricePaid: MoneyString;
  /** Snapshot of the rate used, e.g. "0.3000". */
  commissionRateSnapshot: string;
  platformAmount: MoneyString;
  instructorAmount: MoneyString;
  /** null for free courses: no money moves, so no ledger transaction exists. */
  ledgerTransactionId: string | null;
  walletBalance: MoneyString;
}
