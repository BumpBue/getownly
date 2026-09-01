import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ContentReportStatus, ContentReportTargetType } from '@prisma/client';

export class CreateContentReportDto {
  @IsIn(Object.values(ContentReportTargetType), { message: 'ประเภทเนื้อหาที่แจ้งไม่ถูกต้อง' })
  targetType!: ContentReportTargetType;

  /** The Course id or the QnaThread id, depending on targetType. */
  @IsString({ message: 'กรุณาระบุเนื้อหาที่ต้องการแจ้ง' })
  @MinLength(1, { message: 'กรุณาระบุเนื้อหาที่ต้องการแจ้ง' })
  targetId!: string;

  @IsString()
  @MinLength(10, { message: 'กรุณาอธิบายเหตุผลอย่างน้อย 10 ตัวอักษร' })
  @MaxLength(500, { message: 'เหตุผลต้องยาวไม่เกิน 500 ตัวอักษร' })
  reason!: string;
}

export const CONTENT_REPORT_DECISIONS = ['REVIEWED', 'DISMISSED'] as const;
export type ContentReportDecision = (typeof CONTENT_REPORT_DECISIONS)[number];

export class ReviewContentReportDto {
  @IsIn(CONTENT_REPORT_DECISIONS, { message: 'ผลการตรวจสอบไม่ถูกต้อง' })
  status!: ContentReportDecision;

  /**
   * Only meaningful when targetType is COURSE and status is REVIEWED — every
   * other combination ignores it rather than erroring, since asking to
   * suspend while dismissing a report is simply not a request this makes.
   */
  @IsOptional()
  @IsBoolean({ message: 'ค่าระงับคอร์สต้องเป็นจริงหรือเท็จ' })
  suspendCourse?: boolean;
}

export class ListContentReportsQueryDto {
  @IsOptional()
  @IsIn(Object.values(ContentReportStatus), { message: 'สถานะที่กรองไม่ถูกต้อง' })
  status?: ContentReportStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50, { message: 'ขอข้อมูลได้ครั้งละไม่เกิน 50 รายการ' })
  limit?: number;
}
