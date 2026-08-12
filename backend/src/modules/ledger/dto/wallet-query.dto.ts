import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Paging for the wallet statement. Query values arrive as strings. */
export class WalletQueryDto {
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
