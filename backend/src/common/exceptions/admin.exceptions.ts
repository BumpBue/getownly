import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './business.exception';

// Errors raised by the admin back office and the profile screen.

export class UserNotFoundException extends BusinessException {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND', 'ไม่พบผู้ใช้ที่ระบุ');
  }
}

/**
 * An admin cannot suspend their own account.
 *
 * Not politeness: JwtAuthGuard re-reads the user on every request, so the very
 * next call would be refused and the last admin could lock the platform out of
 * its own back office.
 */
export class CannotSuspendSelfException extends BusinessException {
  constructor() {
    super(
      HttpStatus.CONFLICT,
      'CANNOT_SUSPEND_SELF',
      'ระงับบัญชีของตัวเองไม่ได้ กรุณาให้ผู้ดูแลคนอื่นดำเนินการแทน',
    );
  }
}

/** A commission rate only means something for someone who sells courses. */
export class CommissionNotApplicableException extends BusinessException {
  constructor(role: string) {
    super(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'COMMISSION_NOT_APPLICABLE',
      'ตั้งอัตราส่วนแบ่งได้เฉพาะบัญชีผู้สอนเท่านั้น',
      { role },
    );
  }
}

/** Approving or rejecting only makes sense while a course is under review. */
export class CourseNotUnderReviewException extends BusinessException {
  constructor(currentStatus: string) {
    super(
      HttpStatus.CONFLICT,
      'COURSE_NOT_UNDER_REVIEW',
      'ตรวจสอบได้เฉพาะคอร์สที่อยู่ระหว่างรอตรวจสอบเท่านั้น',
      { currentStatus },
    );
  }
}

export class CategoryNameTakenException extends BusinessException {
  constructor() {
    super(HttpStatus.CONFLICT, 'CATEGORY_NAME_TAKEN', 'มีหมวดหมู่ชื่อนี้หรือ slug นี้อยู่แล้ว');
  }
}

/** Deleting a category with courses in it would orphan every one of them. */
export class CategoryInUseException extends BusinessException {
  constructor(courseCount: number) {
    super(
      HttpStatus.CONFLICT,
      'CATEGORY_IN_USE',
      'หมวดหมู่นี้ยังมีคอร์สอยู่ จึงลบไม่ได้ กรุณาย้ายคอร์สไปหมวดอื่นก่อน',
      { courseCount },
    );
  }
}

/** The current password did not match, so the new one is not accepted. */
export class WrongCurrentPasswordException extends BusinessException {
  constructor() {
    super(HttpStatus.UNPROCESSABLE_ENTITY, 'WRONG_CURRENT_PASSWORD', 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
  }
}

/** The key is not shaped like an avatar upload, or it belongs to someone else. */
export class InvalidAvatarKeyException extends BusinessException {
  constructor() {
    super(
      HttpStatus.BAD_REQUEST,
      'INVALID_AVATAR_KEY',
      'ไฟล์รูปโปรไฟล์ไม่ถูกต้อง กรุณาอัปโหลดใหม่อีกครั้ง',
    );
  }
}

/** The client asked to use a key that has nothing behind it in MinIO. */
export class AvatarNotUploadedException extends BusinessException {
  constructor() {
    super(
      HttpStatus.BAD_REQUEST,
      'AVATAR_NOT_UPLOADED',
      'ยังไม่พบไฟล์รูปโปรไฟล์ที่อัปโหลด กรุณาอัปโหลดแล้วลองใหม่อีกครั้ง',
    );
  }
}

/** `from` later than `to`, which would silently report zero of everything. */
export class InvalidDateRangeException extends BusinessException {
  constructor() {
    super(
      HttpStatus.BAD_REQUEST,
      'INVALID_DATE_RANGE',
      'ช่วงวันที่ไม่ถูกต้อง วันเริ่มต้นต้องไม่อยู่หลังวันสิ้นสุด',
    );
  }
}
