import { Transform, Type } from 'class-transformer';
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

/** The three states the board can be filtered to, as the tab strip shows them. */
export const QNA_FILTERS = ['all', 'unanswered', 'answered'] as const;
export type QnaFilter = (typeof QNA_FILTERS)[number];

export class ListQnaQueryDto {
  @IsOptional()
  @IsIn(QNA_FILTERS, { message: 'ตัวเลือกการกรองไม่ถูกต้อง' })
  filter?: QnaFilter;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  // A repeated query key arrives as an array; anything that is not a plain
  // string is dropped rather than passed on, as the catalog search does.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : undefined))
  search?: string;

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

export class CreateQnaThreadDto {
  @IsString()
  @MinLength(5, { message: 'หัวข้อคำถามต้องยาวอย่างน้อย 5 ตัวอักษร' })
  @MaxLength(150, { message: 'หัวข้อคำถามต้องยาวไม่เกิน 150 ตัวอักษร' })
  title!: string;

  @IsString()
  @MinLength(10, { message: 'รายละเอียดคำถามต้องยาวอย่างน้อย 10 ตัวอักษร' })
  @MaxLength(5000, { message: 'รายละเอียดคำถามต้องยาวไม่เกิน 5,000 ตัวอักษร' })
  body!: string;

  /** Optional: ties the question to one lesson of the same course. */
  @IsOptional()
  @IsString()
  lessonId?: string;
}

export class CreateQnaReplyDto {
  @IsString()
  @MinLength(2, { message: 'คำตอบต้องยาวอย่างน้อย 2 ตัวอักษร' })
  @MaxLength(5000, { message: 'คำตอบต้องยาวไม่เกิน 5,000 ตัวอักษร' })
  body!: string;
}

export class ResolveQnaThreadDto {
  /**
   * Omitted means "close it", which is what the button does. The field exists
   * so a thread closed by mistake can be reopened without a second endpoint.
   */
  @IsOptional()
  @IsBoolean()
  isResolved?: boolean;
}
