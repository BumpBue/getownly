import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { MaterialNotFoundException } from '@/common/exceptions/catalog.exceptions';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PrismaService } from '@/infra/prisma.service';
import { StorageService } from '@/infra/storage/storage.service';
import { CourseAccessService } from '@/modules/courses/course-access.service';
import { NotCourseOwnerException } from '@/common/exceptions/catalog.exceptions';
import {
  FileNotFoundException,
  FileTooLargeException,
  InvalidFileKeyException,
  UnsupportedFileTypeException,
} from '@/modules/uploads/uploads.errors';
import {
  UPLOAD_RULES,
  maxBytesFor,
  maxMbFor,
  parseObjectKey,
} from '@/modules/uploads/upload-rules';
import type { MaterialDto } from '@/modules/lessons/dto/lesson-response.dto';
import type { CreateMaterialDto } from './dto/create-material.dto';

@Injectable()
export class MaterialsService {
  private readonly maxDocumentBytes = maxBytesFor('material');
  private readonly maxDocumentMb = maxMbFor('material');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly access: CourseAccessService,
  ) {}

  /**
   * Attaches an already-uploaded file to a lesson.
   *
   * The presign step checked the *claimed* size and type. This step checks the
   * file that actually arrived, because nothing stops a client from presigning
   * a 1KB PDF and then PUTting a 2GB video to the same URL.
   */
  async create(
    lessonId: string,
    user: AuthenticatedUser,
    dto: CreateMaterialDto,
  ): Promise<MaterialDto> {
    const lesson = await this.access.assertLessonOwner(lessonId, user);

    const parsed = parseObjectKey(dto.fileKey);
    if (!parsed || parsed.kind !== 'material') {
      throw new InvalidFileKeyException();
    }
    // The key embeds who uploaded it; only that person may attach it.
    if (user.role !== Role.ADMIN && parsed.ownerId !== user.id) {
      throw new NotCourseOwnerException();
    }

    const stored = await this.storage.stat(dto.fileKey);
    if (!stored) {
      throw new FileNotFoundException();
    }
    if (stored.sizeBytes > this.maxDocumentBytes) {
      throw new FileTooLargeException(this.maxDocumentMb, stored.sizeBytes);
    }
    if (!(dto.mimeType in UPLOAD_RULES.material.extensionByMimeType)) {
      throw new UnsupportedFileTypeException(UPLOAD_RULES.material.acceptLabel, dto.mimeType);
    }
    // Re-checked against the real size: the presign step only saw what the
    // client claimed (CLAUDE.md, scope 2.3.2 - the running total, not a fresh
    // SUM, is what makes this cheap to check again here).
    this.access.assertStorageAvailable(lesson.course.storageUsedBytes, stored.sizeBytes);

    const material = await this.prisma.material.create({
      data: {
        lessonId,
        fileName: dto.fileName.trim(),
        fileKey: dto.fileKey,
        // The real size wins over whatever the client reported.
        fileSize: stored.sizeBytes,
        mimeType: dto.mimeType,
      },
      select: {
        id: true,
        lessonId: true,
        fileName: true,
        fileKey: true,
        fileSize: true,
        mimeType: true,
        createdAt: true,
      },
    });

    await this.access.adjustStorageUsage(lesson.courseId, stored.sizeBytes);

    return { ...material, createdAt: material.createdAt.toISOString() };
  }

  async remove(materialId: string, user: AuthenticatedUser): Promise<{ message: string }> {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      select: { id: true, fileKey: true, fileSize: true, lessonId: true },
    });

    if (!material) {
      throw new MaterialNotFoundException();
    }

    // Ownership is decided by the course the lesson belongs to, never by the
    // uploader id in the key.
    const lesson = await this.access.assertLessonOwner(material.lessonId, user);

    await this.prisma.material.delete({ where: { id: materialId } });
    await this.access.adjustStorageUsage(lesson.courseId, -material.fileSize);
    await this.storage.remove(material.fileKey);

    return { message: 'ลบเอกสารประกอบเรียบร้อยแล้ว' };
  }
}
