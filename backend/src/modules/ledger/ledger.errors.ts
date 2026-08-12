import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '@/common/exceptions/business.exception';

// Errors raised by the money services. English code, Thai message.
// Anything a user can trigger is 4xx; anything that means the ledger code
// itself is wrong is 5xx, because it must never happen in production.

export class InsufficientBalanceException extends BusinessException {
  constructor(required: string, available: string) {
    super(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'INSUFFICIENT_WALLET_BALANCE',
      'ยอดเงินในกระเป๋าไม่เพียงพอ กรุณาเติมเงินก่อนทำรายการ',
      { required, available },
    );
  }
}

export class TopupRequestNotFoundException extends BusinessException {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'TOPUP_REQUEST_NOT_FOUND', 'ไม่พบคำขอเติมเงินที่ระบุ');
  }
}

export class TopupNotPendingException extends BusinessException {
  constructor(currentStatus: string) {
    super(
      HttpStatus.CONFLICT,
      'TOPUP_NOT_PENDING',
      'คำขอเติมเงินนี้ถูกตรวจสอบไปแล้ว ไม่สามารถดำเนินการซ้ำได้',
      { currentStatus },
    );
  }
}

export class TopupRejectNoteRequiredException extends BusinessException {
  constructor() {
    super(
      HttpStatus.BAD_REQUEST,
      'TOPUP_REJECT_NOTE_REQUIRED',
      'กรุณาระบุเหตุผลที่ปฏิเสธคำขอเติมเงิน',
    );
  }
}

// Raised by the catalog too, so it is declared once in common/ and re-exported
// here to keep this file the single import for everything the money code throws.
export { CourseNotFoundException } from '@/common/exceptions/catalog.exceptions';

export class CourseNotPurchasableException extends BusinessException {
  constructor(currentStatus: string) {
    super(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'COURSE_NOT_PURCHASABLE',
      'คอร์สนี้ยังไม่เปิดขาย จึงยังซื้อไม่ได้',
      { currentStatus },
    );
  }
}

export class AlreadyEnrolledException extends BusinessException {
  constructor() {
    super(HttpStatus.CONFLICT, 'ALREADY_ENROLLED', 'คุณลงทะเบียนคอร์สนี้ไปแล้ว');
  }
}

export class CannotBuyOwnCourseException extends BusinessException {
  constructor() {
    super(HttpStatus.FORBIDDEN, 'CANNOT_BUY_OWN_COURSE', 'ไม่สามารถซื้อคอร์สของตัวเองได้');
  }
}

export class WalletAccountNotFoundException extends BusinessException {
  constructor(userId: string) {
    super(HttpStatus.NOT_FOUND, 'WALLET_ACCOUNT_NOT_FOUND', 'ไม่พบกระเป๋าเงินของผู้ใช้รายนี้', {
      userId,
    });
  }
}

export class SystemAccountNotFoundException extends BusinessException {
  constructor(kind: string) {
    super(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'SYSTEM_ACCOUNT_NOT_FOUND',
      'ไม่พบบัญชีกลางของระบบ กรุณาติดต่อผู้ดูแลระบบ',
      { kind },
    );
  }
}

/**
 * Raised before anything is written when the entries handed to the ledger do
 * not balance. Reaching this means a bug in a calling service, so the whole
 * enclosing transaction is rolled back.
 */
export class UnbalancedLedgerException extends BusinessException {
  constructor(debitTotal: string, creditTotal: string) {
    super(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'LEDGER_TRANSACTION_UNBALANCED',
      'รายการบัญชีไม่สมดุล ระบบยกเลิกรายการนี้แล้ว',
      { debitTotal, creditTotal },
    );
  }
}

export class InvalidLedgerAmountException extends BusinessException {
  constructor(amount: string) {
    super(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'LEDGER_AMOUNT_INVALID',
      'จำนวนเงินของรายการบัญชีไม่ถูกต้อง ระบบยกเลิกรายการนี้แล้ว',
      { amount },
    );
  }
}
