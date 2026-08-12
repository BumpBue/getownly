import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

/**
 * Recorded after the browser has already PUT the file to MinIO. The values
 * describe what was uploaded; the service re-checks them against the object
 * that actually landed, so a client cannot register a 5GB file as 1KB.
 */
export class CreateMaterialDto {
  @IsString()
  @MinLength(1, { message: 'กรุณาระบุชื่อไฟล์' })
  @MaxLength(255, { message: 'ชื่อไฟล์ยาวเกินไป' })
  fileName!: string;

  /** Object key returned by POST /uploads/presign with kind "material". */
  @IsString()
  @MinLength(1, { message: 'กรุณาระบุรหัสไฟล์' })
  @MaxLength(300)
  fileKey!: string;

  @Type(() => Number)
  @IsInt({ message: 'ขนาดไฟล์ไม่ถูกต้อง' })
  @Min(1, { message: 'ไฟล์ว่างเปล่า ไม่สามารถแนบได้' })
  fileSize!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  mimeType!: string;
}
