import { apiRequest } from "@/lib/api-client";
import type {
  AdminTopupRequest,
  MyEnrollment,
  PaginatedAdminTopups,
  PaginatedTopups,
  PurchaseResult,
  TopupQuote,
  TopupRequest,
  TopupReviewResult,
  TopupStatus,
  WalletPage,
} from "./types";

/** Thin wrappers over the wallet, top-up and enrolment endpoints. */

// --- wallet ----------------------------------------------------------------

export function getWallet(page = 1, limit = 20): Promise<WalletPage> {
  return apiRequest<WalletPage>(`/wallet?page=${page}&limit=${limit}`);
}

// --- top-up ----------------------------------------------------------------

/** Draws a QR. Records nothing, so it is safe to call on every amount change. */
export function requestTopupQuote(amount: string): Promise<TopupQuote> {
  return apiRequest<TopupQuote>("/topups/quote", { method: "POST", body: { amount } });
}

export function submitTopup(amount: string, slipKey: string): Promise<TopupRequest> {
  return apiRequest<TopupRequest>("/topups", { method: "POST", body: { amount, slipKey } });
}

export function listMyTopups(page = 1, limit = 10): Promise<PaginatedTopups> {
  return apiRequest<PaginatedTopups>(`/topups/mine?page=${page}&limit=${limit}`);
}

// --- courses ---------------------------------------------------------------

export function purchaseCourse(courseId: string): Promise<PurchaseResult> {
  // Only the id travels: price and buyer are read from the database and the
  // session on the server side.
  return apiRequest<PurchaseResult>(`/courses/${courseId}/purchase`, { method: "POST" });
}

export function listMyEnrollments(): Promise<MyEnrollment[]> {
  return apiRequest<MyEnrollment[]>("/enrollments/mine");
}

// --- admin -----------------------------------------------------------------

export function listTopupsForAdmin(options: {
  status?: TopupStatus;
  page?: number;
  limit?: number;
}): Promise<PaginatedAdminTopups> {
  const params = new URLSearchParams();
  if (options.status) {
    params.set("status", options.status);
  }
  params.set("page", String(options.page ?? 1));
  params.set("limit", String(options.limit ?? 10));

  return apiRequest<PaginatedAdminTopups>(`/admin/topups?${params.toString()}`);
}

export function approveTopup(id: string): Promise<TopupReviewResult> {
  return apiRequest<TopupReviewResult>(`/admin/topups/${id}/approve`, { method: "PATCH" });
}

export function rejectTopup(id: string, note: string): Promise<TopupReviewResult> {
  return apiRequest<TopupReviewResult>(`/admin/topups/${id}/reject`, {
    method: "PATCH",
    body: { note },
  });
}

export type { AdminTopupRequest };
