import { IsString, MaxLength, MinLength } from 'class-validator';
import { TrimAndLowercase } from '@/common/transforms';

export class LoginDto {
  /** Accepts either an email address or a username. */
  @TrimAndLowercase()
  @IsString({ message: 'กรุณากรอกอีเมลหรือชื่อผู้ใช้' })
  @MinLength(3, { message: 'กรุณากรอกอีเมลหรือชื่อผู้ใช้' })
  @MaxLength(255, { message: 'อีเมลหรือชื่อผู้ใช้ยาวเกินกำหนด' })
  identifier!: string;

  @IsString({ message: 'กรุณากรอกรหัสผ่าน' })
  @MinLength(1, { message: 'กรุณากรอกรหัสผ่าน' })
  @MaxLength(72, { message: 'รหัสผ่านยาวเกินกำหนด' })
  password!: string;
}
