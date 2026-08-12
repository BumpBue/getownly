import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { TopupStatus } from '@prisma/client';
import { Trim } from '@/common/transforms';

/**
 * Money arrives as a fixed-point string and is never parsed into a JS number
 * on the way in (CLAUDE.md, "เรื่องเงิน"). The pattern only proves the shape;
 * the min/max range comes from `.env` and is checked in the service, because a
 * DTO cannot read configuration.
 */
const AMOUNT_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;
const AMOUNT_MESSAGE = 'จำนวนเงินต้องเป็นตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง';

export class TopupQuoteRequestDto {
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: AMOUNT_MESSAGE })
  amount!: string;
}

export class CreateTopupDto {
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: AMOUNT_MESSAGE })
  amount!: string;

  /** Object key from POST /uploads/presign with kind "slip", not a URL. */
  @IsString()
  @MaxLength(300)
  slipKey!: string;
}

export class RejectTopupDto {
  @Trim()
  @IsString()
  @MaxLength(500, { message: 'เหตุผลต้องยาวไม่เกิน 500 ตัวอักษร' })
  @Matches(/\S/, { message: 'กรุณาระบุเหตุผลที่ปฏิเสธคำขอเติมเงิน' })
  note!: string;
}

/** Shared paging, since both the owner's history and the admin queue use it. */
export class ListTopupsQueryDto {
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

export class AdminListTopupsQueryDto extends ListTopupsQueryDto {
  /** Omitted means every status, which is what the "ทั้งหมด" tab asks for. */
  @IsOptional()
  @IsIn(Object.values(TopupStatus), { message: 'สถานะที่กรองไม่ถูกต้อง' })
  status?: TopupStatus;
}
