import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น ปปปป-ดด-วว';

export class ReportRangeQueryDto {
  /** Inclusive, in Asia/Bangkok. Defaults to 29 days before `to`. */
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  from?: string;

  /** Inclusive, in Asia/Bangkok. Defaults to today. */
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  to?: string;
}

/**
 * The instructor's per-transaction earnings table (ทก.01 A10).
 *
 * Both filters are optional and both narrow an already-scoped set: the query
 * behind this always pins `Course.instructorId` to the caller's own id, so
 * neither field can widen what is visible.
 */
export class EarningTransactionsQueryDto {
  /** Limit to one course. Ownership is checked before the query runs. */
  @IsOptional()
  @IsString()
  courseId?: string;

  /** Inclusive, in Asia/Bangkok. */
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  from?: string;

  /** Inclusive, in Asia/Bangkok. */
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100, { message: 'ขอข้อมูลได้ครั้งละไม่เกิน 100 รายการ' })
  limit?: number;
}
