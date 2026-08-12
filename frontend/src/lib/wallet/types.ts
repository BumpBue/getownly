/**
 * The wallet, top-up and enrolment shapes the API returns.
 *
 * Mirrors backend/src/modules/ledger/dto/ledger-response.dto.ts,
 * backend/src/modules/topups/dto/topup-response.dto.ts and
 * backend/src/modules/enrollments/dto/enrollment-response.dto.ts. When one side
 * changes, change the other in the same commit — the same arrangement
 * lib/catalog/types.ts uses.
 *
 * Every amount is a fixed-point string ("1290.00"), never a number.
 */

export const TOPUP_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type TopupStatus = (typeof TOPUP_STATUSES)[number];

export const LEDGER_TX_TYPES = ["TOPUP", "PURCHASE"] as const;
export type LedgerTxType = (typeof LEDGER_TX_TYPES)[number];

export type EntryDirection = "DEBIT" | "CREDIT";

export interface WalletEntry {
  entryId: string;
  transactionId: string;
  type: LedgerTxType;
  /** Thai, written by the service that posted the movement. */
  description: string;
  direction: EntryDirection;
  /** Always positive. */
  amount: string;
  /** Negative when money left the wallet, positive when it came in. */
  signedAmount: string;
  createdAt: string;
}

export interface WalletPage {
  balance: string;
  entries: WalletEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TopupQuote {
  amount: string;
  /** Raw EMVCo payload, shown so it can be copied by hand. */
  payload: string;
  /** PNG data URI, ready for <img src>. */
  qrDataUrl: string;
  expiresAt: string;
  promptpayId: string;
  promptpayName: string;
  /** Drives the "do not actually transfer" warning beside every QR. */
  isDemoMode: boolean;
}

export interface TopupRequest {
  id: string;
  amount: string;
  status: TopupStatus;
  note: string | null;
  slipUrl: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface PaginatedTopups {
  items: TopupRequest[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TopupRequester {
  id: string;
  displayName: string;
  username: string;
  email: string;
}

export interface AdminTopupRequest extends TopupRequest {
  student: TopupRequester;
  studentWalletBalance: string;
  studentApprovedCount: number;
  reviewedBy: { id: string; displayName: string } | null;
}

export interface PaginatedAdminTopups {
  items: AdminTopupRequest[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  pendingTotal: number;
}

export interface TopupReviewResult {
  topupRequestId: string;
  status: TopupStatus;
  amount: string;
  reviewedById: string;
  reviewedAt: string;
  ledgerTransactionId: string | null;
  walletBalance: string;
}

export interface PurchaseResult {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  instructorId: string;
  pricePaid: string;
  commissionRateSnapshot: string;
  platformAmount: string;
  instructorAmount: string;
  ledgerTransactionId: string | null;
  walletBalance: string;
}

export interface MyEnrollment {
  id: string;
  pricePaid: string;
  enrolledAt: string;
  courseId: string;
  courseTitle: string;
  coverUrl: string | null;
  instructorName: string;
  lessonCount: number;
  completedLessonCount: number;
  progressPercent: number;
  totalDurationSec: number;
}

/** The buttons on /wallet/topup, in baht. */
export const QUICK_TOPUP_AMOUNTS = ["300", "500", "1000", "2000"] as const;
