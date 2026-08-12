import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { TrimAndLowercase } from '@/common/transforms';

export class ForgotPasswordDto {
  @TrimAndLowercase()
  @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
  @MaxLength(255, { message: 'อีเมลยาวเกินกำหนด' })
  email!: string;
}

export class ResetPasswordDto {
  @IsString({ message: 'ลิงก์ตั้งรหัสผ่านใหม่ไม่ถูกต้อง' })
  @MinLength(16, { message: 'ลิงก์ตั้งรหัสผ่านใหม่ไม่ถูกต้อง' })
  @MaxLength(256, { message: 'ลิงก์ตั้งรหัสผ่านใหม่ไม่ถูกต้อง' })
  token!: string;

  @IsString({ message: 'กรุณากรอกรหัสผ่าน' })
  @MinLength(8, { message: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร' })
  @MaxLength(72, { message: 'รหัสผ่านต้องยาวไม่เกิน 72 ตัวอักษร' })
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข',
  })
  password!: string;
}
