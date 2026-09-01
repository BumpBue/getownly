import { Injectable } from '@nestjs/common';
import { AccountKind, CourseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/infra/prisma.service';
import type { ReportRangeQueryDto } from './dto/report-request.dto';
import type {
  AdminOverviewDto,
  DailySalesDto,
  InstructorOverviewDto,
  MetricDto,
  TopCourseDto,
  TopInstructorDto,
  TrialBalanceDto,
} from './dto/report-response.dto';
import {
  REPORT_TIME_ZONE,
  changePercent,
  eachDate,
  lastMonths,
  previousRange,
  resolveRange,
  startOfBangkokDayUtc,
  toRangeDto,
  todayInBangkok,
  toThaiMonthLabel,
  type ResolvedRange,
} from './report-range';

const TOP_LIST_SIZE = 5;
const INSTRUCTOR_CHART_MONTHS = 6;
const RECENT_DAYS = 30;

/**
 * The Thai calendar date a ledger row falls on.
 *
 * `createdAt` is a timestamp without a zone holding UTC, so it is labelled UTC
 * first and only then read in Bangkok. Skipping the first step would have
 * Postgres apply the server's own zone, and the same database would report
 * different days on different machines.
 */
const BANGKOK_DATE = Prisma.sql`((lt."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${REPORT_TIME_ZONE})::date`;

/** Money totals, as Postgres returns them. */
interface SumsRow {
  gross: Prisma.Decimal | null;
  platform: Prisma.Decimal | null;
  instructor: Prisma.Decimal | null;
  sales_count: bigint;
}

/**
 * Every report in the system.
 *
 * One rule decides the shape of all of it: **the numbers come from
 * `LedgerEntry`, never from `Enrollment` or `Course`**. A purchase writes one
 * balanced transaction — the buyer's wallet is debited, the instructor's wallet
 * and `PLATFORM_REVENUE` are credited — so summing those entries is summing the
 * same rows the trial balance is built from. Reading `Enrollment.pricePaid`
 * instead would produce a second set of books that could quietly drift.
 *
 * The grouping keys are the only thing joined in from elsewhere: a ledger
 * transaction knows which enrollment caused it, and that is how an amount finds
 * its course.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------

  async adminOverview(query: ReportRangeQueryDto): Promise<AdminOverviewDto> {
    const range = resolveRange(query);
    const previous = previousRange(range);

    const [current, prior, newUsers, priorUsers] = await Promise.all([
      this.sumPurchases(range),
      this.sumPurchases(previous),
      this.countNewUsers(range),
      this.countNewUsers(previous),
    ]);

    return {
      range: toRangeDto(range, previous),
      grossSales: metric(money(current.gross), money(prior.gross)),
      platformRevenue: metric(money(current.platform), money(prior.platform)),
      instructorPayable: metric(money(current.instructor), money(prior.instructor)),
      newUsers: metric(String(newUsers), String(priorUsers)),
      salesCount: metric(String(Number(current.sales_count)), String(Number(prior.sales_count))),
    };
  }

  /** One point per day, including the days nothing sold. */
  async dailySales(query: ReportRangeQueryDto): Promise<DailySalesDto> {
    const range = resolveRange(query);

    const rows = await this.prisma.$queryRaw<
      {
        day: Date;
        gross: Prisma.Decimal | null;
        platform: Prisma.Decimal | null;
        sales_count: bigint;
      }[]
    >`
      SELECT
        ${BANGKOK_DATE} AS day,
        COALESCE(SUM(CASE WHEN le.direction = 'DEBIT' AND a.kind = 'USER_WALLET'
                          THEN le.amount END), 0) AS gross,
        COALESCE(SUM(CASE WHEN le.direction = 'CREDIT' AND a.kind = 'PLATFORM_REVENUE'
                          THEN le.amount END), 0) AS platform,
        COUNT(DISTINCT lt.id) AS sales_count
      FROM "LedgerEntry" le
      JOIN "LedgerTransaction" lt ON lt.id = le."transactionId"
      JOIN "Account" a ON a.id = le."accountId"
      WHERE lt.type = 'PURCHASE'
        AND lt."createdAt" >= ${range.fromUtc}
        AND lt."createdAt" < ${range.toUtcExclusive}
      GROUP BY day
      ORDER BY day ASC
    `;

    // A chart with holes in it reads as missing data rather than as a quiet
    // day, so every date in the window gets a point.
    const byDate = new Map(rows.map((row) => [toIsoDate(row.day), row]));

    return {
      range: toRangeDto(range, previousRange(range)),
      points: eachDate(range).map((date) => {
        const row = byDate.get(date);
        return {
          date,
          grossSales: money(row?.gross ?? null),
          platformRevenue: money(row?.platform ?? null),
          salesCount: Number(row?.sales_count ?? 0),
        };
      }),
    };
  }

  /**
   * The five courses that took the most money in the window.
   *
   * The amounts are ledger entries; only the course they belong to comes from
   * a join, through the enrollment the transaction references.
   */
  async topCourses(query: ReportRangeQueryDto): Promise<TopCourseDto[]> {
    const range = resolveRange(query);

    const rows = await this.prisma.$queryRaw<
      {
        course_id: string;
        title: string;
        instructor_name: string;
        sales_count: bigint;
        gross: Prisma.Decimal;
        platform: Prisma.Decimal;
      }[]
    >`
      SELECT
        c.id AS course_id,
        c.title AS title,
        u."displayName" AS instructor_name,
        COUNT(DISTINCT lt.id) AS sales_count,
        COALESCE(SUM(CASE WHEN le.direction = 'DEBIT' AND a.kind = 'USER_WALLET'
                          THEN le.amount END), 0) AS gross,
        COALESCE(SUM(CASE WHEN le.direction = 'CREDIT' AND a.kind = 'PLATFORM_REVENUE'
                          THEN le.amount END), 0) AS platform
      FROM "LedgerEntry" le
      JOIN "LedgerTransaction" lt ON lt.id = le."transactionId"
      JOIN "Account" a ON a.id = le."accountId"
      JOIN "Enrollment" e ON e.id = lt."referenceId"
      JOIN "Course" c ON c.id = e."courseId"
      JOIN "User" u ON u.id = c."instructorId"
      WHERE lt.type = 'PURCHASE'
        AND lt."referenceType" = 'Enrollment'
        AND lt."createdAt" >= ${range.fromUtc}
        AND lt."createdAt" < ${range.toUtcExclusive}
      GROUP BY c.id, c.title, u."displayName"
      ORDER BY gross DESC, sales_count DESC
      LIMIT ${TOP_LIST_SIZE}
    `;

    return rows.map((row) => ({
      courseId: row.course_id,
      title: row.title,
      instructorName: row.instructor_name,
      salesCount: Number(row.sales_count),
      grossSales: money(row.gross),
      platformRevenue: money(row.platform),
    }));
  }

  /**
   * The five instructors who earned the most in the window.
   *
   * In a purchase, the CREDIT that lands on a `USER_WALLET` is the instructor's
   * share — the platform's share goes to `PLATFORM_REVENUE`, and the buyer is
   * on the DEBIT side. Filtering on account kind is what separates them.
   */
  async topInstructors(query: ReportRangeQueryDto): Promise<TopInstructorDto[]> {
    const range = resolveRange(query);

    const rows = await this.prisma.$queryRaw<
      {
        instructor_id: string;
        display_name: string;
        sales_count: bigint;
        earnings: Prisma.Decimal;
        outstanding: Prisma.Decimal;
      }[]
    >`
      SELECT
        a."ownerId" AS instructor_id,
        u."displayName" AS display_name,
        COUNT(DISTINCT CASE WHEN lt."createdAt" >= ${range.fromUtc}
                             AND lt."createdAt" < ${range.toUtcExclusive}
                            THEN lt.id END) AS sales_count,
        COALESCE(SUM(CASE WHEN lt."createdAt" >= ${range.fromUtc}
                           AND lt."createdAt" < ${range.toUtcExclusive}
                          THEN le.amount END), 0) AS earnings,
        -- No PAYOUT transaction type exists yet, so everything ever credited
        -- to an instructor is still owed to them.
        COALESCE(SUM(le.amount), 0) AS outstanding
      FROM "LedgerEntry" le
      JOIN "LedgerTransaction" lt ON lt.id = le."transactionId"
      JOIN "Account" a ON a.id = le."accountId"
      JOIN "User" u ON u.id = a."ownerId"
      WHERE lt.type = 'PURCHASE'
        AND le.direction = 'CREDIT'
        AND a.kind = 'USER_WALLET'
      GROUP BY a."ownerId", u."displayName"
      HAVING COALESCE(SUM(CASE WHEN lt."createdAt" >= ${range.fromUtc}
                                AND lt."createdAt" < ${range.toUtcExclusive}
                               THEN le.amount END), 0) > 0
      ORDER BY earnings DESC
      LIMIT ${TOP_LIST_SIZE}
    `;

    return rows.map((row) => ({
      instructorId: row.instructor_id,
      displayName: row.display_name,
      salesCount: Number(row.sales_count),
      earnings: money(row.earnings),
      outstandingAmount: money(row.outstanding),
    }));
  }

  /**
   * งบทดลอง — the trial balance. Grouped by account kind rather than by
   * individual account: there is one USER_WALLET per user, and a row per
   * person would be a screen nobody could read, only one they could scroll
   * past. All-time, not windowed by a date range — a trial balance answers
   * "do the books balance", not "did they balance last week".
   *
   * `assertEveryTransactionBalances` proves the same fact per transaction in
   * the test suite; this is that proof surfaced for a human to look at,
   * summed straight from `LedgerEntry` so it can never disagree with it.
   */
  async trialBalance(): Promise<TrialBalanceDto> {
    const rows = await this.prisma.$queryRaw<
      {
        kind: AccountKind;
        account_count: bigint;
        total_debit: Prisma.Decimal;
        total_credit: Prisma.Decimal;
      }[]
    >`
      SELECT
        a.kind AS kind,
        COUNT(DISTINCT a.id) AS account_count,
        COALESCE(SUM(CASE WHEN le.direction = 'DEBIT' THEN le.amount END), 0) AS total_debit,
        COALESCE(SUM(CASE WHEN le.direction = 'CREDIT' THEN le.amount END), 0) AS total_credit
      FROM "Account" a
      LEFT JOIN "LedgerEntry" le ON le."accountId" = a.id
      GROUP BY a.kind
      ORDER BY a.kind ASC
    `;

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    const trialRows = rows.map((row) => {
      totalDebit = totalDebit.plus(row.total_debit);
      totalCredit = totalCredit.plus(row.total_credit);

      return {
        kind: row.kind,
        accountCount: Number(row.account_count),
        totalDebit: money(row.total_debit),
        totalCredit: money(row.total_credit),
        netBalance: row.total_credit.minus(row.total_debit).toFixed(2),
      };
    });

    return {
      rows: trialRows,
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      // Comparing formatted strings, not the Decimal objects themselves: two
      // Decimals can be mathematically equal while disagreeing on internal
      // scale, and toFixed(2) is the precision every amount in this system
      // actually leaves as.
      isBalanced: totalDebit.toFixed(2) === totalCredit.toFixed(2),
      asOf: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Instructor
  // -------------------------------------------------------------------------

  async instructorOverview(instructorId: string): Promise<InstructorOverviewDto> {
    const months = lastMonths(INSTRUCTOR_CHART_MONTHS);
    const chartFrom = startOfBangkokDayUtc(`${months[0]}-01`);
    const recentFrom = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
    const todayFrom = startOfBangkokDayUtc(todayInBangkok());

    const [totals, recent, today, monthlyRows, courseRows, counts, wallet] = await Promise.all([
      this.sumInstructorEarnings(instructorId, null),
      this.sumInstructorEarnings(instructorId, recentFrom),
      this.sumInstructorEarnings(instructorId, todayFrom),
      this.instructorMonthly(instructorId, chartFrom),
      this.instructorCourseSales(instructorId),
      this.instructorCounts(instructorId),
      this.prisma.account.findFirst({
        where: { ownerId: instructorId, kind: AccountKind.USER_WALLET },
        select: { balance: true },
      }),
    ]);

    const byMonth = new Map(monthlyRows.map((row) => [row.month, row]));

    return {
      totalEarnings: money(totals.earnings),
      totalGrossSales: money(totals.gross),
      totalSalesCount: Number(totals.sales_count),
      last30DaysEarnings: money(recent.earnings),
      // "Today" as Bangkok sees it - the /home quick-action card, not the
      // 6-month chart, which is what actually needs this granularity.
      todayEarnings: money(today.earnings),
      todaySalesCount: Number(today.sales_count),
      studentCount: counts.students,
      publishedCourses: counts.published,
      totalCourses: counts.total,
      pendingQuestions: counts.pendingQuestions,
      walletBalance: money(wallet?.balance ?? null),
      monthly: months.map((month) => {
        const row = byMonth.get(month);
        return {
          month,
          label: toThaiMonthLabel(month),
          salesCount: Number(row?.sales_count ?? 0),
          earnings: money(row?.earnings ?? null),
        };
      }),
      courses: courseRows,
    };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** The three sides of every purchase in a window, in one pass. */
  private async sumPurchases(range: ResolvedRange): Promise<SumsRow> {
    const [row] = await this.prisma.$queryRaw<SumsRow[]>`
      SELECT
        COALESCE(SUM(CASE WHEN le.direction = 'DEBIT' AND a.kind = 'USER_WALLET'
                          THEN le.amount END), 0) AS gross,
        COALESCE(SUM(CASE WHEN le.direction = 'CREDIT' AND a.kind = 'PLATFORM_REVENUE'
                          THEN le.amount END), 0) AS platform,
        COALESCE(SUM(CASE WHEN le.direction = 'CREDIT' AND a.kind = 'USER_WALLET'
                          THEN le.amount END), 0) AS instructor,
        COUNT(DISTINCT lt.id) AS sales_count
      FROM "LedgerEntry" le
      JOIN "LedgerTransaction" lt ON lt.id = le."transactionId"
      JOIN "Account" a ON a.id = le."accountId"
      WHERE lt.type = 'PURCHASE'
        AND lt."createdAt" >= ${range.fromUtc}
        AND lt."createdAt" < ${range.toUtcExclusive}
    `;

    return row ?? { gross: null, platform: null, instructor: null, sales_count: 0n };
  }

  private countNewUsers(range: ResolvedRange): Promise<number> {
    return this.prisma.user.count({
      where: { createdAt: { gte: range.fromUtc, lt: range.toUtcExclusive } },
    });
  }

  /**
   * What one instructor's courses took, and what of it they kept.
   *
   * Scoped by the *course's* owner rather than by the credited account, so both
   * sides of each purchase are counted from the same set of transactions: the
   * buyer's DEBIT is the gross, the instructor's CREDIT is the earning.
   */
  private async sumInstructorEarnings(
    instructorId: string,
    from: Date | null,
  ): Promise<{
    earnings: Prisma.Decimal | null;
    gross: Prisma.Decimal | null;
    sales_count: bigint;
  }> {
    const [row] = await this.prisma.$queryRaw<
      { earnings: Prisma.Decimal | null; gross: Prisma.Decimal | null; sales_count: bigint }[]
    >`
      SELECT
        COALESCE(SUM(CASE WHEN le.direction = 'CREDIT' AND a."ownerId" = ${instructorId}
                          THEN le.amount END), 0) AS earnings,
        COALESCE(SUM(CASE WHEN le.direction = 'DEBIT' AND a.kind = 'USER_WALLET'
                          THEN le.amount END), 0) AS gross,
        COUNT(DISTINCT lt.id) AS sales_count
      FROM "LedgerTransaction" lt
      JOIN "Enrollment" e ON e.id = lt."referenceId"
      JOIN "Course" c ON c.id = e."courseId"
      JOIN "LedgerEntry" le ON le."transactionId" = lt.id
      JOIN "Account" a ON a.id = le."accountId"
      WHERE lt.type = 'PURCHASE'
        AND lt."referenceType" = 'Enrollment'
        AND c."instructorId" = ${instructorId}
        ${from ? Prisma.sql`AND lt."createdAt" >= ${from}` : Prisma.empty}
    `;

    return row ?? { earnings: null, gross: null, sales_count: 0n };
  }

  private instructorMonthly(
    instructorId: string,
    from: Date,
  ): Promise<{ month: string; earnings: Prisma.Decimal; sales_count: bigint }[]> {
    return this.prisma.$queryRaw`
      SELECT
        TO_CHAR(${BANGKOK_DATE}, 'YYYY-MM') AS month,
        COALESCE(SUM(le.amount), 0) AS earnings,
        COUNT(DISTINCT lt.id) AS sales_count
      FROM "LedgerEntry" le
      JOIN "LedgerTransaction" lt ON lt.id = le."transactionId"
      JOIN "Account" a ON a.id = le."accountId"
      WHERE lt.type = 'PURCHASE'
        AND le.direction = 'CREDIT'
        AND a.kind = 'USER_WALLET'
        AND a."ownerId" = ${instructorId}
        AND lt."createdAt" >= ${from}
      GROUP BY month
      ORDER BY month ASC
    `;
  }

  /** Per course: what it sold, and what of that the instructor kept. */
  private async instructorCourseSales(
    instructorId: string,
  ): Promise<InstructorOverviewDto['courses']> {
    const rows = await this.prisma.$queryRaw<
      {
        course_id: string;
        title: string;
        status: CourseStatus;
        sales_count: bigint;
        earnings: Prisma.Decimal;
        gross: Prisma.Decimal;
      }[]
    >`
      SELECT
        c.id AS course_id,
        c.title AS title,
        c.status AS status,
        COUNT(DISTINCT lt.id) AS sales_count,
        COALESCE(SUM(CASE WHEN le.direction = 'CREDIT' AND a."ownerId" = c."instructorId"
                          THEN le.amount END), 0) AS earnings,
        COALESCE(SUM(CASE WHEN le.direction = 'DEBIT' AND a.kind = 'USER_WALLET'
                          THEN le.amount END), 0) AS gross
      FROM "Course" c
      LEFT JOIN "Enrollment" e ON e."courseId" = c.id
      LEFT JOIN "LedgerTransaction" lt
        ON lt."referenceId" = e.id AND lt."referenceType" = 'Enrollment' AND lt.type = 'PURCHASE'
      LEFT JOIN "LedgerEntry" le ON le."transactionId" = lt.id
      LEFT JOIN "Account" a ON a.id = le."accountId"
      WHERE c."instructorId" = ${instructorId}
      GROUP BY c.id, c.title, c.status
      ORDER BY earnings DESC, c."createdAt" DESC
    `;

    return rows.map((row) => ({
      courseId: row.course_id,
      title: row.title,
      status: row.status,
      salesCount: Number(row.sales_count),
      earnings: money(row.earnings),
      grossSales: money(row.gross),
    }));
  }

  private async instructorCounts(instructorId: string): Promise<{
    students: number;
    published: number;
    total: number;
    pendingQuestions: number;
  }> {
    const [students, published, total, pendingQuestions] = await Promise.all([
      this.prisma.enrollment.count({ where: { course: { instructorId } } }),
      this.prisma.course.count({
        where: { instructorId, status: CourseStatus.PUBLISHED },
      }),
      this.prisma.course.count({ where: { instructorId } }),
      // The same definition the Q&A inbox uses: waiting on *this* instructor.
      this.prisma.qnaThread.count({
        where: {
          course: { instructorId },
          isResolved: false,
          replies: { none: { userId: instructorId } },
        },
      }),
    ]);

    return { students, published, total, pendingQuestions };
  }
}

/** Postgres `numeric` to the fixed-point string every amount leaves as. */
function money(value: Prisma.Decimal | null): string {
  return (value ?? new Prisma.Decimal(0)).toFixed(2);
}

function metric(value: string, previousValue: string): MetricDto {
  return { value, previousValue, changePercent: changePercent(value, previousValue) };
}

/** `date` columns arrive as a Date at UTC midnight; only the calendar day matters. */
function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
