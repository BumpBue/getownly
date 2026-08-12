import { Role } from '@prisma/client';
import { IsIn, IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Trim, TrimAndLowercase } from '@/common/transforms';

/** Roles a visitor may pick. ADMIN accounts exist only through the seed. */
export const SELF_SERVICE_ROLES = [Role.STUDENT, Role.INSTRUCTOR] as const;
export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];

export class RegisterDto {
  @TrimAndLowercase()
  @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
  @MaxLength(255, { message: 'อีเมลยาวเกินกำหนด' })
  email!: string;

  @TrimAndLowercase()
  @IsString({ message: 'กรุณากรอกชื่อผู้ใช้' })
  @MinLength(3, { message: 'ชื่อผู้ใช้ต้องยาวอย่างน้อย 3 ตัวอักษร' })
  @MaxLength(30, { message: 'ชื่อผู้ใช้ต้องยาวไม่เกิน 30 ตัวอักษร' })
  @Matches(/^[a-z0-9._]+$/, {
    message: 'ชื่อผู้ใช้ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษตัวเล็ก ตัวเลข จุด และขีดล่าง',
  })
  username!: string;

  @IsString({ message: 'กรุณากรอกรหัสผ่าน' })
  @MinLength(8, { message: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร' })
  @MaxLength(72, { message: 'รหัสผ่านต้องยาวไม่เกิน 72 ตัวอักษร' })
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข',
  })
  password!: string;

  @Trim()
  @IsString({ message: 'กรุณากรอกชื่อที่ใช้แสดง' })
  @MinLength(2, { message: 'ชื่อที่ใช้แสดงต้องยาวอย่างน้อย 2 ตัวอักษร' })
  @MaxLength(80, { message: 'ชื่อที่ใช้แสดงต้องยาวไม่เกิน 80 ตัวอักษร' })
  displayName!: string;

  @IsIn(SELF_SERVICE_ROLES, {
    message: 'เลือกได้เฉพาะบทบาทผู้เรียนหรือผู้สอนเท่านั้น',
  })
  role!: SelfServiceRole;
}
