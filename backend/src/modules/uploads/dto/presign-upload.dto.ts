import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { UPLOAD_KINDS, type UploadKind } from '../upload-rules';

export class PresignUploadDto {
  @IsIn(UPLOAD_KINDS, { message: 'ชนิดไฟล์ที่ขออัปโหลดไม่ถูกต้อง' })
  kind!: UploadKind;

  /** Kept for display only. The stored object name is generated server-side. */
  @IsString()
  @MinLength(1, { message: 'กรุณาระบุชื่อไฟล์' })
  @MaxLength(255, { message: 'ชื่อไฟล์ยาวเกินไป' })
  fileName!: string;

  @IsString()
  @MinLength(1, { message: 'กรุณาระบุชนิดของไฟล์' })
  @MaxLength(150)
  mimeType!: string;

  @Type(() => Number)
  @IsInt({ message: 'ขนาดไฟล์ไม่ถูกต้อง' })
  @Min(1, { message: 'ไฟล์ว่างเปล่า ไม่สามารถอัปโหลดได้' })
  fileSize!: number;

  /**
   * Required when `kind` is "video" or "material": which course's 3 GB
   * storage cap to check (scope 2.3.2). Every other kind ignores it.
   */
  @IsOptional()
  @IsString()
  courseId?: string;
}

export interface PresignUploadResponseDto {
  /** Temporary URL the browser PUTs the raw file to. */
  uploadUrl: string;
  /** The key to send back to the API once the upload succeeds. */
  fileKey: string;
  /** Seconds until `uploadUrl` stops working. */
  expiresIn: number;
}

export interface SignedUrlResponseDto {
  url: string;
  expiresIn: number;
}
