import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { CourseStorageLimitExceededException } from '@/common/exceptions/catalog.exceptions';
import { PrismaService } from '@/infra/prisma.service';
import { CourseAccessService } from '@/modules/courses/course-access.service';
import { COURSE_MAX_STORAGE_BYTES } from '@/modules/uploads/upload-rules';
import { FileTooLargeException } from '@/modules/uploads/uploads.errors';
import { MaterialsService } from './materials.service';
import {
  asAuthUser,
  createCategory,
  createCourse,
  createLesson,
  createUser,
  resetDatabase,
  type TestUser,
} from '../../../test/factories';
import { FakeStorage } from '../../../test/fake-storage';

const MB = 1024 * 1024;

/**
 * Scope 2.3.2: attaching or removing a material keeps Course.storageUsedBytes
 * in step, so the 3 GB cap can be checked from that one cached number.
 */
describe('MaterialsService', () => {
  let prisma: PrismaService;
  let storage: FakeStorage;
  let materials: MaterialsService;

  let owner: TestUser;
  let courseId: string;
  let lessonId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    storage = new FakeStorage();
    materials = new MaterialsService(
      prisma,
      storage.asService(),
      new CourseAccessService(prisma),
      new ConfigService({ UPLOAD_MAX_DOCUMENT_MB: 50 }),
    );

    owner = await createUser(prisma, { role: 'INSTRUCTOR' });
    const categoryId = await createCategory(prisma);
    courseId = await createCourse(prisma, { instructorId: owner.id, categoryId, price: '990.00' });
    lessonId = await createLesson(prisma, { courseId, orderIndex: 1, videoKey: null });
  });

  async function courseStorageUsed(): Promise<bigint> {
    const course = await prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      select: { storageUsedBytes: true },
    });
    return course.storageUsedBytes;
  }

  describe('create', () => {
    it('adds the real file size onto the course total, not the claimed one', async () => {
      const fileKey = `material/${owner.id}/handout.pdf`;
      storage.put(fileKey, Buffer.alloc(5 * MB), 'application/pdf');

      await materials.create(lessonId, asAuthUser(owner), {
        fileName: 'คู่มือ.pdf',
        fileKey,
        // Claims 1KB; the real file is 5MB. The real size is what counts.
        fileSize: 1024,
        mimeType: 'application/pdf',
      });

      expect(await courseStorageUsed()).toBe(BigInt(5 * MB));
    });

    it('refuses an attachment that would push the course over 3 GB', async () => {
      await prisma.course.update({
        where: { id: courseId },
        data: { storageUsedBytes: BigInt(COURSE_MAX_STORAGE_BYTES) - BigInt(1 * MB) },
      });

      const fileKey = `material/${owner.id}/big.pdf`;
      storage.put(fileKey, Buffer.alloc(5 * MB), 'application/pdf');

      await expect(
        materials.create(lessonId, asAuthUser(owner), {
          fileName: 'ไฟล์ใหญ่.pdf',
          fileKey,
          fileSize: 5 * MB,
          mimeType: 'application/pdf',
        }),
      ).rejects.toBeInstanceOf(CourseStorageLimitExceededException);

      // The rejected attempt never touched the running total.
      expect(await courseStorageUsed()).toBe(BigInt(COURSE_MAX_STORAGE_BYTES) - BigInt(1 * MB));
    });

    it('still enforces the per-file size ceiling regardless of the course cap', async () => {
      const fileKey = `material/${owner.id}/oversized.pdf`;
      storage.put(fileKey, Buffer.alloc(60 * MB), 'application/pdf');

      await expect(
        materials.create(lessonId, asAuthUser(owner), {
          fileName: 'เกินขนาด.pdf',
          fileKey,
          fileSize: 60 * MB,
          mimeType: 'application/pdf',
        }),
      ).rejects.toBeInstanceOf(FileTooLargeException);
    });
  });

  describe('remove', () => {
    it('subtracts the file size back off the course total', async () => {
      const fileKey = `material/${owner.id}/handout.pdf`;
      storage.put(fileKey, Buffer.alloc(3 * MB), 'application/pdf');

      const material = await materials.create(lessonId, asAuthUser(owner), {
        fileName: 'คู่มือ.pdf',
        fileKey,
        fileSize: 3 * MB,
        mimeType: 'application/pdf',
      });
      expect(await courseStorageUsed()).toBe(BigInt(3 * MB));

      await materials.remove(material.id, asAuthUser(owner));

      expect(await courseStorageUsed()).toBe(0n);
    });
  });
});
