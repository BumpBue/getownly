import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '@/common/exceptions/business.exception';

// Errors the top-up flow raises. English code, Thai message, same as everywhere
// else. Errors that belong to the money services themselves live in
// modules/ledger/ledger.errors.ts and are re-exported by the service that
// throws them.

export class TopupAmountOutOfRangeException extends BusinessException {
  constructor(min: string, max: string) {
    super(
      HttpStatus.BAD_REQUEST,
      'TOPUP_AMOUNT_OUT_OF_RANGE',
      `จำนวนเงินที่เติมได้ต่อครั้งอยู่ระหว่าง ${min} ถึง ${max} บาท`,
      { min, max },
    );
  }
}

export class InvalidSlipKeyException extends BusinessException {
  constructor() {
    super(
      HttpStatus.BAD_REQUEST,
      'TOPUP_SLIP_KEY_INVALID',
      'ไฟล์สลิปไม่ถูกต้อง กรุณาอัปโหลดสลิปใหม่อีกครั้ง',
    );
  }
}

/**
 * The client asked to attach a key that has nothing behind it in MinIO —
 * usually an upload that failed silently, or a key made up by hand.
 */
export class SlipNotUploadedException extends BusinessException {
  constructor() {
    super(
      HttpStatus.BAD_REQUEST,
      'TOPUP_SLIP_NOT_UPLOADED',
      'ยังไม่พบไฟล์สลิปที่อัปโหลด กรุณาอัปโหลดสลิปแล้วลองใหม่อีกครั้ง',
    );
  }
}

export class SlipTooLargeException extends BusinessException {
  constructor(maxMb: number, actualBytes: number) {
    super(
      HttpStatus.PAYLOAD_TOO_LARGE,
      'TOPUP_SLIP_TOO_LARGE',
      `ไฟล์สลิปต้องมีขนาดไม่เกิน ${maxMb} MB`,
      { maxMb, actualBytes },
    );
  }
}

/**
 * A cap on how many requests one person can leave waiting. The review queue is
 * a human looking at pictures, so an unbounded queue is a denial of service
 * against the admin rather than against the server.
 */
export class TooManyPendingTopupsException extends BusinessException {
  constructor(limit: number) {
    super(
      HttpStatus.CONFLICT,
      'TOPUP_TOO_MANY_PENDING',
      `คุณมีคำขอเติมเงินที่รอตรวจสอบอยู่ ${limit} รายการแล้ว กรุณารอผลการตรวจสอบก่อนแจ้งโอนเพิ่ม`,
      { limit },
    );
  }
}

/** Nobody reviews their own transfer, whatever role they hold. */
export class CannotReviewOwnTopupException extends BusinessException {
  constructor() {
    super(
      HttpStatus.FORBIDDEN,
      'CANNOT_REVIEW_OWN_TOPUP',
      'ไม่สามารถตรวจสอบคำขอเติมเงินของตัวเองได้',
    );
  }
}

export class QrGenerationFailedException extends BusinessException {
  constructor() {
    super(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'QR_GENERATION_FAILED',
      'สร้างรหัส QR ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    );
  }
}
