import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './business.exception';

// Errors raised by the content-report queue (scope 2.3.4).

export class ContentReportNotFoundException extends BusinessException {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'CONTENT_REPORT_NOT_FOUND', 'ไม่พบรายการที่ถูกแจ้ง');
  }
}

/**
 * A report is judged once. Without this, two admins with the same queue open
 * could both act on it — one suspending a course the other had already
 * dismissed as fine.
 */
export class ContentReportAlreadyReviewedException extends BusinessException {
  constructor() {
    super(
      HttpStatus.CONFLICT,
      'CONTENT_REPORT_ALREADY_REVIEWED',
      'รายการนี้มีการตัดสินใจไปแล้ว ไม่สามารถตรวจสอบซ้ำได้',
    );
  }
}

/**
 * "Restore" only makes sense for a report whose course is actually SUSPENDED
 * right now — not a QNA_THREAD report, not a course already PUBLISHED,
 * UNPUBLISHED by its own instructor, or in any other status.
 */
export class CourseNotSuspendedException extends BusinessException {
  constructor() {
    super(
      HttpStatus.CONFLICT,
      'COURSE_NOT_SUSPENDED',
      'คืนสถานะเผยแพร่ได้เฉพาะคอร์สที่ถูกระงับอยู่เท่านั้น',
    );
  }
}
