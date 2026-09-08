import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { PayoutStatus } from '@prisma/client';
import { BANK_CODES } from '@getownly/shared';
import { Trim } from '@/common/transforms';

/**
 * Money arrives as a fixed-point string and is never parsed into a JS number
 * on the way in (CLAUDE.md, "เรื่องเงิน"). The pattern only proves the shape;
 * the floor and the wallet ceiling are decided in the service, after the
 * account row has been locked.
 */
const AMOUNT_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;
const AMOUNT_MESSAGE = 'จำนวนเงินต้องเป็นตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง';

export class SaveBankAccountDto {
  /**
   * A Bank of Thailand code from the shared list, not a name.
   *
   * Checked here against that list rather than trusted from the browser: the
   * dropdown exists to help somebody choose, not to decide what is valid.
   */
  @IsString()
  @IsIn(BANK_CODES, { message: 'กรุณาเลือกธนาคารจากรายการ' })
  bankCode!: string;

  @Trim()
  @IsString()
  @MaxLength(150, { message: 'ชื่อบัญชีต้องยาวไม่เกิน 150 ตัวอักษร' })
  @Matches(/\S/, { message: 'กรุณาระบุชื่อบัญชี' })
  accountName!: string;

  /**
   * Digits, with spaces or dashes allowed, because that is how an account
   * number is printed on a passbook. Between 8 and 20 digits covers every
   * Thai bank.
   */
  @Trim()
  @IsString()
  @MaxLength(30)
  @Matches(/^[\d\s-]+$/, { message: 'เลขบัญชีใส่ได้เฉพาะตัวเลข ขีด และเว้นวรรค' })
  @Matches(/^(?:\D*\d){8,20}\D*$/, {
    message: 'เลขบัญชีต้องเป็นตัวเลข 8–20 หลัก (มีขีดหรือเว้นวรรคคั่นได้)',
  })
  accountNumber!: string;
}

export class CreatePayoutDto {
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: AMOUNT_MESSAGE })
  amount!: string;
}

export class RejectPayoutDto {
  @Trim()
  @IsString()
  @MaxLength(500, { message: 'เหตุผลต้องยาวไม่เกิน 500 ตัวอักษร' })
  @Matches(/\S/, { message: 'กรุณาระบุเหตุผลที่ปฏิเสธคำขอถอนเงิน' })
  note!: string;
}

/** Shared paging, since both the owner's history and the admin queue use it. */
export class ListPayoutsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50, { message: 'ขอข้อมูลได้ครั้งละไม่เกิน 50 รายการ' })
  limit?: number;
}

export class AdminListPayoutsQueryDto extends ListPayoutsQueryDto {
  /** Omitted means every status, which is what the "ทั้งหมด" tab asks for. */
  @IsOptional()
  @IsIn(Object.values(PayoutStatus), { message: 'สถานะที่กรองไม่ถูกต้อง' })
  status?: PayoutStatus;
}
