/**
 * The instructor-withdrawal shapes the API returns.
 *
 * Mirrors backend/src/modules/payouts/dto/payout-response.dto.ts. When one side
 * changes, change the other in the same commit — the arrangement
 * lib/wallet/types.ts and lib/catalog/types.ts already use.
 *
 * Every amount is a fixed-point string ("1290.00"), never a number.
 */

export const PAYOUT_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

/**
 * Bank details as the API hands them back everywhere except the owner's own
 * form: the number is already masked, and there is no unmasked field to leak.
 */
export interface MaskedBankAccount {
  bankName: string;
  accountName: string;
  accountNumberMasked: string;
}

/** The owner's own details, for the form where they are edited. */
export interface BankAccount {
  bankName: string;
  accountName: string;
  accountNumber: string;
  updatedAt: string;
}

export interface PayoutRequest {
  id: string;
  amount: string;
  status: PayoutStatus;
  bankAccount: MaskedBankAccount;
  note: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface PayoutOverview {
  walletBalance: string;
  /**
   * The same number as `walletBalance`, and deliberately sent separately: a
   * request that is waiting has already left the wallet, so there is nothing
   * held back. The page says so rather than leaving it to be assumed.
   */
  withdrawableAmount: string;
  /** The pending request's amount, or "0.00". */
  pendingAmount: string;
  minimumAmount: string;
  bankAccount: MaskedBankAccount | null;
  pendingRequest: PayoutRequest | null;
}

export interface PaginatedPayouts {
  items: PayoutRequest[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** A row in the admin queue. Masked, like every listing. */
export interface AdminPayoutListItem {
  id: string;
  amount: string;
  status: PayoutStatus;
  instructor: {
    id: string;
    displayName: string;
    walletBalance: string;
  };
  bankName: string;
  accountName: string;
  accountNumberMasked: string;
  note: string | null;
  reviewedBy: { id: string; displayName: string } | null;
  reviewedAt: string | null;
  createdAt: string;
}

/** One opened request, the only admin payload carrying the number in full. */
export interface AdminPayoutRequest extends Omit<AdminPayoutListItem, "accountNumberMasked"> {
  accountNumber: string;
}

export interface PaginatedAdminPayouts {
  items: AdminPayoutListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  pendingTotal: number;
  pendingAmountTotal: string;
}

export interface PayoutReviewResult {
  payoutRequestId: string;
  status: PayoutStatus;
  amount: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  ledgerTransactionId: string;
  walletBalance: string;
}
