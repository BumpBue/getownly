import type { PayoutStatus } from '@prisma/client';

/** A fixed-point string such as "1250.00", never a JS number. */
type MoneyString = string;

/**
 * An instructor's bank details as they themselves see them, on the form where
 * they are edited. The only shape in the whole API that carries the account
 * number in full to its owner.
 */
export interface BankAccountDto {
  bankName: string;
  accountName: string;
  accountNumber: string;
  updatedAt: string;
}

/** The same details, everywhere else. */
export interface MaskedBankAccountDto {
  bankName: string;
  accountName: string;
  /** Masked to the last four digits by maskAccountNumber(). */
  accountNumberMasked: string;
}

export interface PayoutRequestDto {
  id: string;
  amount: MoneyString;
  status: PayoutStatus;
  /** Snapshot of where the money was to be sent, masked. */
  bankAccount: MaskedBankAccountDto;
  note: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/**
 * What the instructor's withdrawal page needs, in one request.
 *
 * `walletBalance` and `withdrawableAmount` are the same number, and
 * deliberately both present: a pending request has already left the wallet, so
 * there is no second figure to reconcile. `pendingAmount` is what is currently
 * in flight, shown beside them so the difference from yesterday's balance is
 * accounted for rather than mysterious.
 */
export interface PayoutOverviewDto {
  walletBalance: MoneyString;
  withdrawableAmount: MoneyString;
  /** Amount of the one pending request, or "0.00" when there is none. */
  pendingAmount: MoneyString;
  minimumAmount: MoneyString;
  bankAccount: MaskedBankAccountDto | null;
  pendingRequest: PayoutRequestDto | null;
}

export interface PaginatedPayoutsDto {
  items: PayoutRequestDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * A row in the queue.
 *
 * Masked, even for an admin. A queue is a list somebody scrolls past, and
 * putting twenty account numbers on screen to review one of them is handing
 * out nineteen for no reason. The full number arrives when a row is opened.
 */
export interface AdminPayoutListItemDto {
  id: string;
  amount: MoneyString;
  status: PayoutStatus;
  instructor: {
    id: string;
    displayName: string;
    /** Wallet balance right now, so a reviewer sees the money is set aside. */
    walletBalance: MoneyString;
  };
  bankName: string;
  accountName: string;
  accountNumberMasked: string;
  note: string | null;
  reviewedBy: { id: string; displayName: string } | null;
  reviewedAt: string | null;
  createdAt: string;
}

/**
 * One opened request. Carries the account number in full, because whoever is
 * reading this is about to type it into a banking app — this and the owner's
 * own edit form are the only two responses in the API that do.
 */
export interface AdminPayoutRequestDto extends Omit<AdminPayoutListItemDto, 'accountNumberMasked'> {
  accountNumber: string;
}

export interface PaginatedAdminPayoutsDto {
  items: AdminPayoutListItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  /** Rows still waiting, across every page. */
  pendingTotal: number;
  /** Baht currently held in PAYOUT_PAYABLE, i.e. owed and not yet transferred. */
  pendingAmountTotal: MoneyString;
}

/** What changed after a request was made, approved, rejected or cancelled. */
export interface PayoutReviewResultDto {
  payoutRequestId: string;
  status: PayoutStatus;
  amount: MoneyString;
  reviewedById: string | null;
  reviewedAt: string | null;
  ledgerTransactionId: string;
  /** Wallet balance of the instructor after this step. */
  walletBalance: MoneyString;
}
