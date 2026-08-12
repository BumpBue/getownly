import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './business.exception';

// Authentication and authorisation errors. English code, Thai message.
// Login failures deliberately never say which half was wrong.

export class UnauthenticatedException extends BusinessException {
  constructor() {
    super(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบก่อนใช้งาน');
  }
}

export class InvalidCredentialsException extends BusinessException {
  constructor() {
    super(
      HttpStatus.UNAUTHORIZED,
      'INVALID_CREDENTIALS',
      'อีเมลหรือชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง',
    );
  }
}

export class AccountSuspendedException extends BusinessException {
  constructor() {
    super(
      HttpStatus.FORBIDDEN,
      'ACCOUNT_SUSPENDED',
      'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ',
    );
  }
}

export class ForbiddenRoleException extends BusinessException {
  constructor() {
    super(HttpStatus.FORBIDDEN, 'FORBIDDEN_ROLE', 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้');
  }
}

export class EmailAlreadyUsedException extends BusinessException {
  constructor() {
    super(HttpStatus.CONFLICT, 'EMAIL_ALREADY_USED', 'อีเมลนี้ถูกใช้สมัครไปแล้ว');
  }
}

export class UsernameAlreadyUsedException extends BusinessException {
  constructor() {
    super(HttpStatus.CONFLICT, 'USERNAME_ALREADY_USED', 'ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว');
  }
}

export class InvalidRefreshTokenException extends BusinessException {
  constructor() {
    super(
      HttpStatus.UNAUTHORIZED,
      'INVALID_REFRESH_TOKEN',
      'เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่',
    );
  }
}

export class InvalidPasswordResetTokenException extends BusinessException {
  constructor() {
    super(
      HttpStatus.BAD_REQUEST,
      'INVALID_PASSWORD_RESET_TOKEN',
      'ลิงก์ตั้งรหัสผ่านใหม่ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่อีกครั้ง',
    );
  }
}
