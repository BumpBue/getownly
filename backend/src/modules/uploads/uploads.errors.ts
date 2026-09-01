import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '@/common/exceptions/business.exception';

export class UnsupportedFileTypeException extends BusinessException {
  constructor(acceptLabel: string, mimeType: string) {
    super(
      HttpStatus.BAD_REQUEST,
      'UNSUPPORTED_FILE_TYPE',
      `ชนิดไฟล์นี้ไม่รองรับ กรุณาอัปโหลดไฟล์ ${acceptLabel}`,
      { mimeType },
    );
  }
}

export class FileTooLargeException extends BusinessException {
  constructor(maxMb: number, fileSize: number) {
    super(
      HttpStatus.PAYLOAD_TOO_LARGE,
      'FILE_TOO_LARGE',
      `ไฟล์มีขนาดใหญ่เกินกำหนด อัปโหลดได้ไม่เกิน ${maxMb} MB`,
      { maxMb, fileSize },
    );
  }
}

export class UploadKindNotAllowedException extends BusinessException {
  constructor(kind: string) {
    super(HttpStatus.FORBIDDEN, 'UPLOAD_KIND_NOT_ALLOWED', 'บทบาทของคุณอัปโหลดไฟล์ชนิดนี้ไม่ได้', {
      kind,
    });
  }
}

export class InvalidFileKeyException extends BusinessException {
  constructor() {
    super(HttpStatus.BAD_REQUEST, 'INVALID_FILE_KEY', 'รหัสไฟล์ไม่ถูกต้อง');
  }
}

/**
 * A lesson video is only ever served by GET /lessons/:id/stream, which checks
 * enrolment on every request. Handing out a presigned URL instead would make
 * the video forwardable to anyone (CLAUDE.md, ข้อห้าม 10).
 */
export class VideoNotDownloadableException extends BusinessException {
  constructor() {
    super(
      HttpStatus.FORBIDDEN,
      'VIDEO_REQUIRES_STREAM_ENDPOINT',
      'วิดีโอบทเรียนต้องเปิดผ่านหน้าเรียนเท่านั้น ไม่มีลิงก์สำหรับดาวน์โหลด',
    );
  }
}

export class FileAccessDeniedException extends BusinessException {
  constructor() {
    super(HttpStatus.FORBIDDEN, 'FILE_ACCESS_DENIED', 'คุณไม่มีสิทธิ์เข้าถึงไฟล์นี้');
  }
}

export class FileNotFoundException extends BusinessException {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'FILE_NOT_FOUND', 'ไม่พบไฟล์ที่ระบุ');
  }
}

/**
 * A video or a material counts against its course's 3 GB cap (scope 2.3.2),
 * so the API needs to know which course before it can check there is room.
 */
export class CourseIdRequiredForUploadException extends BusinessException {
  constructor() {
    super(
      HttpStatus.BAD_REQUEST,
      'COURSE_REQUIRED_FOR_UPLOAD',
      'ต้องระบุคอร์สก่อนอัปโหลดวิดีโอหรือเอกสารประกอบ',
    );
  }
}
