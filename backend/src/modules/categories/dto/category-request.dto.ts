import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Lowercase letters, digits and single hyphens: what belongs in a URL. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MESSAGE = 'slug ต้องเป็นตัวอักษรอังกฤษพิมพ์เล็ก ตัวเลข และขีดกลางเท่านั้น';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2, { message: 'ชื่อหมวดหมู่ต้องยาวอย่างน้อย 2 ตัวอักษร' })
  @MaxLength(80, { message: 'ชื่อหมวดหมู่ต้องยาวไม่เกิน 80 ตัวอักษร' })
  name!: string;

  /**
   * Optional because a Thai name has no sensible transliteration to derive
   * one from — when it is left out the service generates a stable fallback
   * rather than guessing at romanisation.
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'ชื่อหมวดหมู่ต้องยาวอย่างน้อย 2 ตัวอักษร' })
  @MaxLength(80, { message: 'ชื่อหมวดหมู่ต้องยาวไม่เกิน 80 ตัวอักษร' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;
}
