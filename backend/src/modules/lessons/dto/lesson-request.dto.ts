import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Ten hours. A single lesson longer than this is a data-entry mistake. */
const MAX_LESSON_SECONDS = 36_000;

export class CreateLessonDto {
  @IsString()
  @MinLength(3, { message: 'ชื่อบทเรียนต้องยาวอย่างน้อย 3 ตัวอักษร' })
  @MaxLength(150, { message: 'ชื่อบทเรียนต้องยาวไม่เกิน 150 ตัวอักษร' })
  title!: string;

  /** Object key from POST /uploads/presign with kind "video". */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  videoKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ความยาวบทเรียนไม่ถูกต้อง' })
  @Min(0)
  @Max(MAX_LESSON_SECONDS, { message: 'ความยาวบทเรียนเกินกว่าที่ระบบรองรับ' })
  durationSec?: number;

  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;
}

export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'ชื่อบทเรียนต้องยาวอย่างน้อย 3 ตัวอักษร' })
  @MaxLength(150, { message: 'ชื่อบทเรียนต้องยาวไม่เกิน 150 ตัวอักษร' })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  videoKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ความยาวบทเรียนไม่ถูกต้อง' })
  @Min(0)
  @Max(MAX_LESSON_SECONDS, { message: 'ความยาวบทเรียนเกินกว่าที่ระบบรองรับ' })
  durationSec?: number;

  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;
}

export class ReorderLessonsDto {
  /** Every lesson id of the course, in the order they should appear. */
  @IsArray({ message: 'ลำดับบทเรียนต้องเป็นรายการของรหัสบทเรียน' })
  @ArrayMinSize(1, { message: 'ต้องมีบทเรียนอย่างน้อย 1 บท' })
  @ArrayMaxSize(500, { message: 'จำนวนบทเรียนเกินกว่าที่ระบบรองรับ' })
  @IsString({ each: true })
  lessonIds!: string[];
}
