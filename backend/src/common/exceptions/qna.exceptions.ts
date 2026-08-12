import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './business.exception';

// Errors raised by the course Q&A.
//
// The three refusals below are deliberately distinct codes rather than one
// generic 403: "you cannot read this board", "you cannot ask here" and "you
// cannot answer here" are three different situations, and the screen says
// something different in each.

/** Not enrolled, not the instructor, not an admin. */
export class QnaAccessDeniedException extends BusinessException {
  constructor() {
    super(
      HttpStatus.FORBIDDEN,
      'QNA_ACCESS_DENIED',
      'ต้องลงทะเบียนคอร์สนี้ก่อนจึงจะเข้าดูกระดานถาม-ตอบได้',
    );
  }
}

/**
 * Asking is for students who bought the course.
 *
 * The instructor is not refused out of pedantry: a question from the person
 * answering them would have nobody to answer it.
 */
export class QnaAskRequiresEnrollmentException extends BusinessException {
  constructor() {
    super(
      HttpStatus.FORBIDDEN,
      'QNA_ASK_REQUIRES_ENROLLMENT',
      'ต้องลงทะเบียนคอร์สนี้ก่อนจึงจะตั้งคำถามได้',
    );
  }
}

/** Answering is for enrolled students and the instructor who owns the course. */
export class QnaReplyNotAllowedException extends BusinessException {
  constructor() {
    super(HttpStatus.FORBIDDEN, 'QNA_REPLY_NOT_ALLOWED', 'คุณไม่มีสิทธิ์ตอบในกระทู้นี้');
  }
}

export class QnaThreadNotFoundException extends BusinessException {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'QNA_THREAD_NOT_FOUND', 'ไม่พบกระทู้ที่ระบุ');
  }
}

/** Closing or deleting is for the person who asked, and for the instructor. */
export class NotQnaThreadOwnerException extends BusinessException {
  constructor(action: 'RESOLVE' | 'DELETE') {
    super(
      HttpStatus.FORBIDDEN,
      'NOT_QNA_THREAD_OWNER',
      action === 'RESOLVE'
        ? 'ปิดกระทู้ได้เฉพาะผู้ตั้งคำถามและผู้สอนเจ้าของคอร์สเท่านั้น'
        : 'ลบกระทู้ได้เฉพาะผู้ตั้งคำถาม ผู้สอนเจ้าของคอร์ส และผู้ดูแลระบบเท่านั้น',
      { action },
    );
  }
}
