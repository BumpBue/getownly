import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Money arrives as a fixed-point string and stays one until Prisma turns it
 * into a Decimal. It is never parsed into a JS number on the way
 * (CLAUDE.md, "เรื่องเงิน").
 */
const PRICE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;
const PRICE_MESSAGE = 'ราคาต้องเป็นตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง';

export const COURSE_SORTS = ['latest', 'popular', 'price_asc', 'price_desc'] as const;
export type CourseSort = (typeof COURSE_SORTS)[number];

export class CreateCourseDto {
  @IsString()
  @MinLength(6, { message: 'ชื่อคอร์สต้องยาวอย่างน้อย 6 ตัวอักษร' })
  @MaxLength(150, { message: 'ชื่อคอร์สต้องยาวไม่เกิน 150 ตัวอักษร' })
  title!: string;

  @IsString()
  @MinLength(20, { message: 'คำอธิบายคอร์สต้องยาวอย่างน้อย 20 ตัวอักษร' })
  @MaxLength(5000, { message: 'คำอธิบายคอร์สต้องยาวไม่เกิน 5000 ตัวอักษร' })
  description!: string;

  @IsString({ message: 'กรุณาเลือกหมวดหมู่' })
  @MinLength(1, { message: 'กรุณาเลือกหมวดหมู่' })
  categoryId!: string;

  @IsOptional()
  @IsString()
  @Matches(PRICE_PATTERN, { message: PRICE_MESSAGE })
  price?: string;

  /** Object key from POST /uploads/presign, not a URL. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  coverKey?: string;
}

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'ชื่อคอร์สต้องยาวอย่างน้อย 6 ตัวอักษร' })
  @MaxLength(150, { message: 'ชื่อคอร์สต้องยาวไม่เกิน 150 ตัวอักษร' })
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(20, { message: 'คำอธิบายคอร์สต้องยาวอย่างน้อย 20 ตัวอักษร' })
  @MaxLength(5000, { message: 'คำอธิบายคอร์สต้องยาวไม่เกิน 5000 ตัวอักษร' })
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Matches(PRICE_PATTERN, { message: PRICE_MESSAGE })
  price?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  coverKey?: string;
}

/** Query string values arrive as strings, so every field is transformed here. */
export class ListCoursesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  // Anything that is not a plain string (a repeated query key arrives as an
  // array) is dropped rather than passed along as an unknown shape.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : undefined))
  search?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Matches(PRICE_PATTERN, { message: PRICE_MESSAGE })
  minPrice?: string;

  @IsOptional()
  @IsString()
  @Matches(PRICE_PATTERN, { message: PRICE_MESSAGE })
  maxPrice?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  freeOnly?: boolean;

  @IsOptional()
  @IsIn(COURSE_SORTS, { message: 'ตัวเลือกการเรียงลำดับไม่ถูกต้อง' })
  sort?: CourseSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48, { message: 'ขอข้อมูลได้ครั้งละไม่เกิน 48 รายการ' })
  limit?: number;
}

export class ListPendingCoursesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48, { message: 'ขอข้อมูลได้ครั้งละไม่เกิน 48 รายการ' })
  limit?: number;
}

export class RejectCourseDto {
  /**
   * Required, and long enough to be a sentence: a rejection is the only thing
   * the instructor gets back, so "ไม่ผ่าน" alone is not an answer.
   */
  @IsString({ message: 'กรุณาระบุเหตุผลที่ไม่อนุมัติ' })
  @MinLength(10, { message: 'เหตุผลต้องยาวอย่างน้อย 10 ตัวอักษร' })
  @MaxLength(500, { message: 'เหตุผลต้องยาวไม่เกิน 500 ตัวอักษร' })
  reason!: string;
}
