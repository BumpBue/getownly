import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '@/common/exceptions/business.exception';

// Errors the payout flow raises. English code, Thai message, same as everywhere
// else in the application.

export class BankAccountRequiredException extends BusinessException {
  constructor() {
    super(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'PAYOUT_BANK_ACCOUNT_REQUIRED',
      'กรุณาบันทึกข้อมูลบัญชีธนาคารก่อนยื่นคำขอถอนเงิน',
    );
  }
}

export class PayoutAmountBelowMinimumException extends BusinessException {
  constructor(minimum: string, requested: string) {
    super(
      HttpStatus.BAD_REQUEST,
      'PAYOUT_AMOUNT_BELOW_MINIMUM',
      `ถอนเงินได้ครั้งละไม่ต่ำกว่า ${minimum} บาท (คุณขอถอน ${requested} บาท)`,
      { minimum, requested },
    );
  }
}

/**
 * The wallet does not hold what was asked for.
 *
 * Money leaves the wallet at the moment a request is made, so unlike the
 * design where a pending request only reserves, an admin can never meet this
 * at approval time — by then the amount is already out of the wallet and
 * sitting in PAYOUT_PAYABLE. It is the instructor who is told, when they ask.
 */
export class PayoutExceedsBalanceException extends BusinessException {
  constructor(balance: string, requested: string) {
    super(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'PAYOUT_INSUFFICIENT_BALANCE',
      `ยอดคงเหลือของคุณคือ ${balance} บาท น้อยกว่าจำนวนที่ขอถอน ${requested} บาท`,
      { balance, requested },
    );
  }
}

export class PayoutAlreadyPendingException extends BusinessException {
  constructor(pendingAmount: string) {
    super(
      HttpStatus.CONFLICT,
      'PAYOUT_ALREADY_PENDING',
      `คุณมีคำขอถอนเงิน ${pendingAmount} บาท ที่รอการอนุมัติอยู่แล้ว ` +
        'กรุณารอผลหรือยกเลิกคำขอเดิมก่อนยื่นใหม่',
      { pendingAmount },
    );
  }
}

export class PayoutRequestNotFoundException extends BusinessException {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'PAYOUT_REQUEST_NOT_FOUND', 'ไม่พบคำขอถอนเงินที่ระบุ');
  }
}

/** Somebody else's request. 403, not 404: the row exists, it is just not theirs. */
export class NotPayoutOwnerException extends BusinessException {
  constructor() {
    super(HttpStatus.FORBIDDEN, 'NOT_PAYOUT_OWNER', 'คำขอถอนเงินนี้ไม่ใช่ของคุณ');
  }
}

export class PayoutNotPendingException extends BusinessException {
  constructor(status: string) {
    super(
      HttpStatus.CONFLICT,
      'PAYOUT_NOT_PENDING',
      'คำขอถอนเงินนี้ถูกดำเนินการไปแล้ว ไม่สามารถทำซ้ำได้',
      { status },
    );
  }
}

export class PayoutRejectNoteRequiredException extends BusinessException {
  constructor() {
    super(
      HttpStatus.BAD_REQUEST,
      'PAYOUT_REJECT_NOTE_REQUIRED',
      'กรุณาระบุเหตุผลที่ปฏิเสธคำขอถอนเงิน',
    );
  }
}

/** An admin reviewing their own request. Impossible through the UI; refused anyway. */
export class CannotReviewOwnPayoutException extends BusinessException {
  constructor() {
    super(
      HttpStatus.FORBIDDEN,
      'CANNOT_REVIEW_OWN_PAYOUT',
      'ไม่สามารถตรวจสอบคำขอถอนเงินของตนเองได้',
    );
  }
}
