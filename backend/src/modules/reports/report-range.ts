import { InvalidDateRangeException } from '@/common/exceptions/admin.exceptions';
import type { DateRangeDto } from './dto/report-response.dto';
import type { ReportRangeQueryDto } from './dto/report-request.dto';

/**
 * Every report is read in Thai time.
 *
 * Timestamps are stored in UTC, so a sale at 01:00 in Bangkok is 18:00 the
 * previous day in UTC. Grouping without converting would put that sale on
 * yesterday's bar and make the daily chart disagree with the receipts.
 */
export const REPORT_TIME_ZONE = 'Asia/Bangkok';

/** Bangkok is UTC+7 all year: Thailand has never observed daylight saving. */
const TIME_ZONE_OFFSET_HOURS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;

/** A half-open window in UTC, plus the Thai dates it was asked for. */
export interface ResolvedRange {
  /** Inclusive UTC instant of 00:00 Bangkok on `fromDate`. */
  fromUtc: Date;
  /** Exclusive UTC instant of 00:00 Bangkok on the day after `toDate`. */
  toUtcExclusive: Date;
  fromDate: string;
  toDate: string;
  /** How many whole days the window covers. */
  days: number;
}

/**
 * Turns `?from=&to=` into the window a query can use.
 *
 * Both ends are inclusive dates as a person would type them, so `to` becomes
 * the start of the *next* day and the comparison stays half-open — otherwise a
 * sale at 23:59:59.500 on the last day would fall outside its own report.
 */
export function resolveRange(query: ReportRangeQueryDto): ResolvedRange {
  const toDate = query.to ?? todayInBangkok();
  const fromDate = query.from ?? shiftDate(toDate, -(DEFAULT_RANGE_DAYS - 1));

  if (fromDate > toDate) {
    throw new InvalidDateRangeException();
  }

  const fromUtc = startOfBangkokDayUtc(fromDate);
  const toUtcExclusive = startOfBangkokDayUtc(shiftDate(toDate, 1));

  return {
    fromUtc,
    toUtcExclusive,
    fromDate,
    toDate,
    days: Math.round((toUtcExclusive.getTime() - fromUtc.getTime()) / MS_PER_DAY),
  };
}

/** The window of the same length ending the day before this one starts. */
export function previousRange(range: ResolvedRange): ResolvedRange {
  const previousTo = shiftDate(range.fromDate, -1);
  const previousFrom = shiftDate(previousTo, -(range.days - 1));

  return {
    fromUtc: startOfBangkokDayUtc(previousFrom),
    toUtcExclusive: startOfBangkokDayUtc(range.fromDate),
    fromDate: previousFrom,
    toDate: previousTo,
    days: range.days,
  };
}

export function toRangeDto(range: ResolvedRange, previous: ResolvedRange): DateRangeDto {
  return {
    from: range.fromDate,
    to: range.toDate,
    previousFrom: previous.fromDate,
    previousTo: previous.toDate,
  };
}

/** Today's date as Bangkok sees it, whatever the server's own clock is set to. */
export function todayInBangkok(): string {
  return toBangkokDate(new Date());
}

/** The Thai calendar date an instant falls on. */
export function toBangkokDate(instant: Date): string {
  const shifted = new Date(instant.getTime() + TIME_ZONE_OFFSET_HOURS * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/** The UTC instant at which a Bangkok day begins. */
export function startOfBangkokDayUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000+07:00`);
}

/** Adds days to a `YYYY-MM-DD` string, staying in that form. */
export function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/** Every date in the window, so a chart has a bar for a day nobody bought anything. */
export function eachDate(range: ResolvedRange): string[] {
  const dates: string[] = [];
  for (let date = range.fromDate; date <= range.toDate; date = shiftDate(date, 1)) {
    dates.push(date);
  }
  return dates;
}

/** The last `count` months as "YYYY-MM", oldest first, ending with this one. */
export function lastMonths(count: number, now = new Date()): string[] {
  const today = toBangkokDate(now);
  const [year, month] = today.split('-').map(Number) as [number, number];

  const months: string[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - back, 1));
    months.push(date.toISOString().slice(0, 7));
  }
  return months;
}

const THAI_MONTH_ABBREVIATIONS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

/** "2026-08" → "ส.ค. 69", the form that fits under a bar in a chart. */
export function toThaiMonthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const buddhistYear = (year + 543) % 100;
  return `${THAI_MONTH_ABBREVIATIONS[monthNumber - 1]} ${String(buddhistYear).padStart(2, '0')}`;
}

/**
 * Percent difference, rounded to one decimal.
 *
 * Null when the previous period was zero — there is no percentage from
 * nothing, and both ∞ and 100% would be inventions.
 */
export function changePercent(current: string, previous: string): number | null {
  const previousValue = Number(previous);
  if (previousValue === 0) {
    return null;
  }
  return Math.round(((Number(current) - previousValue) / previousValue) * 1000) / 10;
}
