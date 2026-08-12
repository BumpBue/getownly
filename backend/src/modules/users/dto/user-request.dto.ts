import { Transform, Type } from 'class-transformer';
import {
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
import { Role, UserStatus } from '@prisma/client';

/**
 * A commission rate as a fixed-point string, never a number: it is multiplied
 * by money (CLAUDE.md, "เรื่องเงิน"). "0.3" and "0.3000" both mean 30%.
 */
const RATE_PATTERN = /^\d(\.\d{1,4})?$/;

/**
 * Half of every sale is the ceiling. Above that the split stops being a
 * marketplace fee and the number is almost certainly a typo.
 */
export const MAX_COMMISSION_RATE = 0.5;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'ชื่อที่แสดงต้องยาวอย่างน้อย 2 ตัวอักษร' })
  @MaxLength(100, { message: 'ชื่อที่แสดงต้องยาวไม่เกิน 100 ตัวอักษร' })
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'ประวัติแนะนำตัวต้องยาวไม่เกิน 1,000 ตัวอักษร' })
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'ความเชี่ยวชาญต้องยาวไม่เกิน 200 ตัวอักษร' })
  expertise?: string;
}

export class ChangePasswordDto {
  @IsString({ message: 'กรุณากรอกรหัสผ่านปัจจุบัน' })
  @MaxLength(72)
  currentPassword!: string;

  @IsString({ message: 'กรุณากรอกรหัสผ่านใหม่' })
  @MinLength(8, { message: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร' })
  @MaxLength(72, { message: 'รหัสผ่านต้องยาวไม่เกิน 72 ตัวอักษร' })
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข' })
  newPassword!: string;
}

export class ListUsersQueryDto {
  @IsOptional()
  @IsIn(Object.values(Role), { message: 'บทบาทที่ระบุไม่ถูกต้อง' })
  role?: Role;

  @IsOptional()
  @IsIn(Object.values(UserStatus), { message: 'สถานะที่ระบุไม่ถูกต้อง' })
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(150)
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

export class UpdateUserStatusDto {
  @IsIn(Object.values(UserStatus), { message: 'สถานะที่ระบุไม่ถูกต้อง' })
  status!: UserStatus;
}

export class UpdateCommissionDto {
  /**
   * Kept as a string all the way to the Decimal column. Parsing it into a JS
   * number on the way past would be the one place a rounding error could enter
   * every future sale that instructor makes.
   */
  @IsString({ message: 'อัตราส่วนแบ่งไม่ถูกต้อง' })
  @Matches(RATE_PATTERN, {
    message: 'อัตราส่วนแบ่งต้องเป็นตัวเลขทศนิยมไม่เกิน 4 ตำแหน่ง เช่น 0.30',
  })
  commissionRate!: string;
}
