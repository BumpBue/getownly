import { apiRequest } from "@/lib/api-client";
import type {
  AdminPayoutRequest,
  BankAccount,
  PaginatedAdminPayouts,
  PaginatedPayouts,
  PayoutOverview,
  PayoutReviewResult,
  PayoutStatus,
} from "./types";

/** Thin wrappers over the payout endpoints. */

// --- instructor -------------------------------------------------------------

export function getPayoutOverview(): Promise<PayoutOverview> {
  return apiRequest<PayoutOverview>("/payouts/overview");
}

/**
 * The caller's own bank details, with the number in full.
 *
 * There is no instructor id in the call: the server reads it from the session,
 * so there is no shape of this request that fetches somebody else's.
 */
export function getBankAccount(): Promise<BankAccount | null> {
  return apiRequest<BankAccount | null>("/payouts/bank-account");
}

export function saveBankAccount(body: {
  bankCode: string;
  accountName: string;
  accountNumber: string;
}): Promise<BankAccount> {
  return apiRequest<BankAccount>("/payouts/bank-account", { method: "PUT", body });
}

export function submitPayout(amount: string): Promise<PayoutReviewResult> {
  return apiRequest<PayoutReviewResult>("/payouts", { method: "POST", body: { amount } });
}

export function listMyPayouts(page = 1, limit = 10): Promise<PaginatedPayouts> {
  return apiRequest<PaginatedPayouts>(`/payouts/mine?page=${page}&limit=${limit}`);
}

/** Withdraws a request that is still PENDING; the money returns at once. */
export function cancelPayout(id: string): Promise<PayoutReviewResult> {
  return apiRequest<PayoutReviewResult>(`/payouts/${id}/cancel`, { method: "POST" });
}

// --- admin ------------------------------------------------------------------

export function listPayoutsForAdmin(options: {
  status?: PayoutStatus;
  page?: number;
  limit?: number;
}): Promise<PaginatedAdminPayouts> {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));

  return apiRequest<PaginatedAdminPayouts>(`/admin/payouts?${params.toString()}`);
}

/**
 * One request, with the account number to transfer to.
 *
 * Fetched only when a row is opened, which is why the listing can stay masked:
 * the number reaches the browser at the moment somebody needs to read it, and
 * not while they are scrolling a queue.
 */
export function readPayoutForAdmin(id: string): Promise<AdminPayoutRequest> {
  return apiRequest<AdminPayoutRequest>(`/admin/payouts/${id}`);
}

export function approvePayout(id: string): Promise<PayoutReviewResult> {
  return apiRequest<PayoutReviewResult>(`/admin/payouts/${id}/approve`, { method: "PATCH" });
}

export function rejectPayout(id: string, note: string): Promise<PayoutReviewResult> {
  return apiRequest<PayoutReviewResult>(`/admin/payouts/${id}/reject`, {
    method: "PATCH",
    body: { note },
  });
}
