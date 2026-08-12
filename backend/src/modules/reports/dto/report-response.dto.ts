import type { MoneyString } from '@/modules/ledger/dto/ledger-response.dto';

/**
 * Report shapes.
 *
 * Every amount here is summed from `LedgerEntry` and leaves as a fixed-point
 * string. Nothing is read from `Enrollment.pricePaid` or from `Course.price`:
 * the ledger is the source of truth for money, and a report that disagreed
 * with it would be a report that disagrees with the trial balance
 * (CLAUDE.md, "Double-entry ledger").
 */

/** One headline number with its comparison against the period before it. */
export interface MetricDto {
  /** Fixed-point money, or a plain integer for counts. */
  value: string;
  previousValue: string;
  /**
   * Percent difference against the previous period, rounded to one decimal.
   * Null when the previous period was zero: "up from nothing" has no
   * percentage, and rendering ∞ or 100% would both be lies.
   */
  changePercent: number | null;
}

export interface DateRangeDto {
  /** Inclusive, ISO date (YYYY-MM-DD) in Asia/Bangkok. */
  from: string;
  to: string;
  /** The window the comparison was made against, same length, immediately before. */
  previousFrom: string;
  previousTo: string;
}

export interface AdminOverviewDto {
  range: DateRangeDto;
  /** Everything students paid, i.e. the DEBIT side of every purchase. */
  grossSales: MetricDto;
  /** The platform's cut, i.e. what was credited to PLATFORM_REVENUE. */
  platformRevenue: MetricDto;
  /**
   * What instructors earned and have not been paid.
   *
   * Accrued and outstanding are the same number today because no PAYOUT
   * transaction type exists yet. When payouts arrive this must subtract them.
   */
  instructorPayable: MetricDto;
  newUsers: MetricDto;
  /** How many purchases, not how much money. */
  salesCount: MetricDto;
}

export interface DailySalesPointDto {
  /** ISO date in Asia/Bangkok. */
  date: string;
  grossSales: MoneyString;
  platformRevenue: MoneyString;
  salesCount: number;
}

export interface DailySalesDto {
  range: DateRangeDto;
  points: DailySalesPointDto[];
}

export interface TopCourseDto {
  courseId: string;
  title: string;
  instructorName: string;
  salesCount: number;
  grossSales: MoneyString;
  platformRevenue: MoneyString;
}

export interface TopInstructorDto {
  instructorId: string;
  displayName: string;
  salesCount: number;
  /** Earned inside the requested range. */
  earnings: MoneyString;
  /** Owed in total, across all time. */
  outstandingAmount: MoneyString;
}

/**
 * One row of the trial balance, grouped by account kind rather than by
 * individual account: there is one USER_WALLET account per user, and a row
 * per person is not a screen an admin can read, only a screen an admin can
 * scroll past.
 */
export interface TrialBalanceRowDto {
  kind: string;
  accountCount: number;
  totalDebit: MoneyString;
  totalCredit: MoneyString;
  /** totalCredit − totalDebit, matching the credit-normal convention every Account.balance already uses. */
  netBalance: MoneyString;
}

/**
 * The proof that the double-entry ledger actually holds: every baht ever
 * debited anywhere was credited somewhere else. All-time, not windowed by a
 * date range — a trial balance answers "do the books balance", not
 * "did they balance last week".
 */
export interface TrialBalanceDto {
  rows: TrialBalanceRowDto[];
  totalDebit: MoneyString;
  totalCredit: MoneyString;
  isBalanced: boolean;
  asOf: string;
}

// --- the instructor's own report -------------------------------------------

export interface InstructorMonthPointDto {
  /** "2026-08" — the month in Asia/Bangkok. */
  month: string;
  /** "ส.ค. 69", ready to print under a bar. */
  label: string;
  salesCount: number;
  earnings: MoneyString;
}

export interface InstructorCourseSalesDto {
  courseId: string;
  title: string;
  status: string;
  salesCount: number;
  /** What this instructor kept, after the platform's share. */
  earnings: MoneyString;
  /** What students paid for it. */
  grossSales: MoneyString;
}

export interface InstructorOverviewDto {
  /** All-time, from the ledger. */
  totalEarnings: MoneyString;
  totalGrossSales: MoneyString;
  totalSalesCount: number;
  /** Earned in the last 30 days, for the "recently" tile. */
  last30DaysEarnings: MoneyString;
  studentCount: number;
  publishedCourses: number;
  totalCourses: number;
  pendingQuestions: number;
  /** Current wallet balance, which is where earnings actually land. */
  walletBalance: MoneyString;
  /** Oldest month first, six of them, gaps filled with zeros. */
  monthly: InstructorMonthPointDto[];
  courses: InstructorCourseSalesDto[];
}
