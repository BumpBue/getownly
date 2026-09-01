import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PrismaService } from '@/infra/prisma.service';
import { StorageService } from '@/infra/storage/storage.service';
import { CourseAccessService } from '@/modules/courses/course-access.service';
import type {
  PresignUploadDto,
  PresignUploadResponseDto,
  SignedUrlResponseDto,
} from './dto/presign-upload.dto';
import {
  CourseIdRequiredForUploadException,
  FileAccessDeniedException,
  FileTooLargeException,
  InvalidFileKeyException,
  UnsupportedFileTypeException,
  UploadKindNotAllowedException,
  VideoNotDownloadableException,
} from './uploads.errors';
import {
  UPLOAD_RULES,
  buildObjectKey,
  maxBytesFor,
  maxMbFor,
  parseObjectKey,
  type UploadLimitsMb,
} from './upload-rules';

/**
 * Files never pass through this API on the way in: the browser uploads
 * straight to MinIO with a presigned URL. What the API keeps is the decision
 * of *whether* to issue that URL, and the matching decision on the way out.
 */
@Injectable()
export class UploadsService {
  private readonly limits: UploadLimitsMb;
  private readonly downloadExpirySeconds: number;
  private readonly uploadExpirySeconds: number;

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
  ) {
    this.limits = {
      video: Number(this.config.getOrThrow<string | number>('UPLOAD_MAX_VIDEO_MB')),
      document: Number(this.config.getOrThrow<string | number>('UPLOAD_MAX_DOCUMENT_MB')),
      image: Number(this.config.getOrThrow<string | number>('UPLOAD_MAX_IMAGE_MB')),
    };
    this.downloadExpirySeconds = Number(
      this.config.getOrThrow<string | number>('MINIO_PRESIGN_EXPIRY_SECONDS'),
    );
    this.uploadExpirySeconds = Number(
      this.config.getOrThrow<string | number>('MINIO_PRESIGN_UPLOAD_EXPIRY_SECONDS'),
    );
  }

  /**
   * Checks role, MIME type and size, then names the object itself.
   *
   * The client's `fileName` is never part of the key: it can contain anything
   * at all, and the extension is derived from the MIME type we just accepted.
   */
  async presignUpload(
    user: AuthenticatedUser,
    dto: PresignUploadDto,
  ): Promise<PresignUploadResponseDto> {
    const rule = UPLOAD_RULES[dto.kind];

    if (rule.allowedRoles !== null && !rule.allowedRoles.includes(user.role)) {
      throw new UploadKindNotAllowedException(dto.kind);
    }

    const extension = rule.extensionByMimeType[dto.mimeType];
    if (!extension) {
      throw new UnsupportedFileTypeException(rule.acceptLabel, dto.mimeType);
    }

    if (dto.fileSize > maxBytesFor(dto.kind, this.limits)) {
      throw new FileTooLargeException(maxMbFor(dto.kind, this.limits), dto.fileSize);
    }

    // Only these two kinds count against a course's 3 GB cap (scope 2.3.2).
    if (dto.kind === 'video' || dto.kind === 'material') {
      if (!dto.courseId) {
        throw new CourseIdRequiredForUploadException();
      }
      const course = await this.access.assertCourseOwner(dto.courseId, user);
      this.access.assertStorageAvailable(course.storageUsedBytes, dto.fileSize);
    }

    const fileKey = buildObjectKey(dto.kind, user.id, randomUUID(), extension);

    return {
      uploadUrl: await this.storage.presignPut(fileKey),
      fileKey,
      expiresIn: this.uploadExpirySeconds,
    };
  }

  /**
   * Issues a temporary read URL, after proving this user may read this file.
   *
   * Lesson videos are refused outright: a presigned URL is forwardable and
   * lives for an hour, so videos go through the streaming endpoint instead,
   * which re-checks enrolment on every single request.
   */
  async signedUrlFor(user: AuthenticatedUser, fileKey: string): Promise<SignedUrlResponseDto> {
    const parsed = parseObjectKey(fileKey);
    if (!parsed) {
      throw new InvalidFileKeyException();
    }

    switch (parsed.kind) {
      case 'video':
        throw new VideoNotDownloadableException();

      // Marketing images. Any signed-in user may see any of them, which is
      // what the catalog needs anyway.
      case 'cover':
      case 'avatar':
        break;

      case 'slip':
        // A transfer slip is between its uploader and the admin reviewing it.
        if (user.role !== Role.ADMIN && parsed.ownerId !== user.id) {
          throw new FileAccessDeniedException();
        }
        break;

      case 'material':
        await this.assertMaterialReadable(user, fileKey);
        break;
    }

    return {
      url: await this.storage.presignGet(fileKey),
      expiresIn: this.downloadExpirySeconds,
    };
  }

  /**
   * A material is readable by the course owner, by admins, by students who
   * bought the course, and by anyone when the lesson is a free preview.
   *
   * The owner id inside the key is *not* used here: it says who uploaded the
   * file, which is not the same question as who may read it.
   */
  private async assertMaterialReadable(user: AuthenticatedUser, fileKey: string): Promise<void> {
    const material = await this.prisma.material.findFirst({
      where: { fileKey },
      select: {
        lesson: {
          select: {
            isPreview: true,
            courseId: true,
            course: { select: { instructorId: true } },
          },
        },
      },
    });

    // An orphan key (uploaded but never attached to a lesson) is readable only
    // by whoever uploaded it, since there is no course to check against yet.
    if (!material) {
      const parsed = parseObjectKey(fileKey);
      if (user.role === Role.ADMIN || parsed?.ownerId === user.id) {
        return;
      }
      throw new FileAccessDeniedException();
    }

    const allowed = await this.access.canReadLessonContent(
      {
        isPreview: material.lesson.isPreview,
        courseId: material.lesson.courseId,
        instructorId: material.lesson.course.instructorId,
      },
      user,
    );

    if (!allowed) {
      throw new FileAccessDeniedException();
    }
  }
}
