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
