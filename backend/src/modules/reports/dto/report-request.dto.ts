import { IsOptional, IsString, Matches } from 'class-validator';

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
