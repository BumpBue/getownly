import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import {
  PresignUploadDto,
  type PresignUploadResponseDto,
  type SignedUrlResponseDto,
} from './dto/presign-upload.dto';
import { UploadsService } from './uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** Ask for somewhere to put a file. Signed-in users only, by default. */
  @HttpCode(HttpStatus.OK)
  @Post('presign')
  presign(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PresignUploadDto,
  ): Promise<PresignUploadResponseDto> {
    return this.uploads.presignUpload(user, dto);
  }

  /**
   * Object keys contain slashes, so the route takes the rest of the path as a
   * wildcard. Express 5 hands that over as an array of segments.
   */
  @Get('signed-url/*key')
  signedUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string | string[],
  ): Promise<SignedUrlResponseDto> {
    return this.uploads.signedUrlFor(user, Array.isArray(key) ? key.join('/') : key);
  }
}
