import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { UPLOAD_RULES, parseObjectKey } from '@/modules/uploads/upload-rules';
import type { MaterialDto } from '@/modules/lessons/dto/lesson-response.dto';
import type { CreateMaterialDto } from './dto/create-material.dto';

const BYTES_PER_MB = 1024 * 1024;

@Injectable()
export class MaterialsService {
  private readonly maxDocumentBytes: number;
  private readonly maxDocumentMb: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly access: CourseAccessService,
    config: ConfigService,
  ) {
    this.maxDocumentMb = Number(config.getOrThrow<string | number>('UPLOAD_MAX_DOCUMENT_MB'));
    this.maxDocumentBytes = this.maxDocumentMb * BYTES_PER_MB;
  }

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
    await this.access.assertLessonOwner(lessonId, user);

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

    return { ...material, createdAt: material.createdAt.toISOString() };
  }

  async remove(materialId: string, user: AuthenticatedUser): Promise<{ message: string }> {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      select: { id: true, fileKey: true, lessonId: true },
    });

    if (!material) {
      throw new MaterialNotFoundException();
    }

    // Ownership is decided by the course the lesson belongs to, never by the
    // uploader id in the key.
    await this.access.assertLessonOwner(material.lessonId, user);

    await this.prisma.material.delete({ where: { id: materialId } });
    await this.storage.remove(material.fileKey);

    return { message: 'ลบเอกสารประกอบเรียบร้อยแล้ว' };
  }
}
