import type { TopupStatus } from '@prisma/client';
import type { MoneyString } from '@/modules/ledger/dto/ledger-response.dto';

/**
 * Shapes that leave the top-up endpoints. Every one is built by an explicit
 * mapper: a top-up row joins to a User, and that row must never travel whole
 * (CLAUDE.md, ข้อห้าม 11).
 */

export interface TopupQuoteDto {
  /** Echoed back normalised, e.g. "500.00" for an input of "500". */
  amount: MoneyString;
  /** The raw EMVCo payload. Shown so it can be copied into a bank app by hand. */
  payload: string;
  /** PNG data URI, ready for <img src>. Never a link to a file on disk. */
  qrDataUrl: string;
  /**
   * Advisory only. Nothing is reserved and no row is written, so a stale QR
   * still pays correctly — this is what the countdown on screen shows.
   */
  expiresAt: string;
  promptpayId: string;
  promptpayName: string;
  /** True while DEMO_MODE is on, which is what makes the warning appear. */
  isDemoMode: boolean;
}

export interface TopupRequestDto {
  id: string;
  amount: MoneyString;
  status: TopupStatus;
  /** The admin's reason. Present on rejection, otherwise null. */
  note: string | null;
  /** Short-lived signed URL of the slip, or null when storage is unreachable. */
  slipUrl: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/** Who transferred the money, for the admin reviewing the slip beside it. */
export interface TopupRequesterDto {
  id: string;
  displayName: string;
  username: string;
  email: string;
}

export interface AdminTopupRequestDto extends TopupRequestDto {
  student: TopupRequesterDto;
  /** Wallet balance right now, so an admin can see what they are adding to. */
  studentWalletBalance: MoneyString;
  /** How many top-ups this person has had approved before. */
  studentApprovedCount: number;
  reviewedBy: { id: string; displayName: string } | null;
}

export interface PaginatedTopupsDto {
  items: TopupRequestDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedAdminTopupsDto {
  items: AdminTopupRequestDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  /** Badge on the queue tab: how many are still waiting, whatever the filter. */
  pendingTotal: number;
  /**
   * Of those, how many have been waiting longer than the service target
   * (ทก.01 D3, TOPUP_REVIEW_TARGET_HOURS). Counted alongside `pendingTotal` in
   * the same statement rather than by a second round trip.
   */
  overdueTotal: number;
}
