import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { CourseStatus } from '@prisma/client';
import { PrismaService } from '@/infra/prisma.service';
import {
  CourseStorageLimitExceededException,
  NotCourseOwnerException,
} from '@/common/exceptions/catalog.exceptions';
import { CourseAccessService } from '@/modules/courses/course-access.service';
import { UploadsService } from './uploads.service';
import {
  CourseIdRequiredForUploadException,
  FileAccessDeniedException,
  FileTooLargeException,
  InvalidFileKeyException,
  UnsupportedFileTypeException,
  UploadKindNotAllowedException,
  VideoNotDownloadableException,
} from './uploads.errors';
import { COURSE_MAX_STORAGE_BYTES, parseObjectKey } from './upload-rules';
import {
  asAuthUser,
  createCategory,
  createCourse,
  createLesson,
  createMaterial,
  createUser,
  enrol,
  resetDatabase,
  type TestUser,
} from '../../../test/factories';
import { FakeStorage } from '../../../test/fake-storage';

const MB = 1024 * 1024;

/** Mirrors the UPLOAD_MAX_* and MINIO_PRESIGN_* values in .env. */
const config = new ConfigService({
  UPLOAD_MAX_VIDEO_MB: 500,
  UPLOAD_MAX_DOCUMENT_MB: 50,
  UPLOAD_MAX_IMAGE_MB: 5,
  MINIO_PRESIGN_EXPIRY_SECONDS: 3600,
  MINIO_PRESIGN_UPLOAD_EXPIRY_SECONDS: 900,
});

describe('UploadsService', () => {
  let prisma: PrismaService;
  let storage: FakeStorage;
  let uploads: UploadsService;

  let instructor: TestUser;
  let student: TestUser;
  let buyer: TestUser;
  let admin: TestUser;
  let courseId: string;

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
    uploads = new UploadsService(
      config,
      storage.asService(),
      prisma,
      new CourseAccessService(prisma),
    );

    instructor = await createUser(prisma, { role: 'INSTRUCTOR' });
    student = await createUser(prisma, { role: 'STUDENT' });
    buyer = await createUser(prisma, { role: 'STUDENT' });
    admin = await createUser(prisma, { role: 'ADMIN' });

    const categoryId = await createCategory(prisma);
    courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '990.00',
    });
  });

  // -------------------------------------------------------------------------
  // Issuing upload URLs
  // -------------------------------------------------------------------------

  describe('presignUpload', () => {
    it('names the object itself, ignoring whatever the client called the file', async () => {
      const result = await uploads.presignUpload(asAuthUser(instructor), {
        kind: 'video',
        fileName: '../../etc/passwd.exe',
        mimeType: 'video/mp4',
        fileSize: 10 * MB,
        courseId,
      });

      expect(result.fileKey).toMatch(new RegExp(`^video/${instructor.id}/[0-9a-f-]{36}\\.mp4$`));
      expect(parseObjectKey(result.fileKey)).toEqual({
        kind: 'video',
        ownerId: instructor.id,
      });
      expect(result.uploadUrl).toContain(result.fileKey);
    });

    it('refuses a MIME type the kind does not accept', async () => {
      await expect(
        uploads.presignUpload(asAuthUser(instructor), {
          kind: 'cover',
          fileName: 'cover.gif',
          mimeType: 'image/gif',
          fileSize: 1024,
        }),
      ).rejects.toBeInstanceOf(UnsupportedFileTypeException);
    });

    it('refuses a file over the limit for its kind', async () => {
      await expect(
        uploads.presignUpload(asAuthUser(instructor), {
          kind: 'cover',
          fileName: 'huge.png',
          mimeType: 'image/png',
          fileSize: 6 * MB,
        }),
      ).rejects.toBeInstanceOf(FileTooLargeException);

      // The same size is fine for a video, which has its own ceiling.
      await expect(
        uploads.presignUpload(asAuthUser(instructor), {
          kind: 'video',
          fileName: 'clip.mp4',
          mimeType: 'video/mp4',
          fileSize: 6 * MB,
          courseId,
        }),
      ).resolves.toMatchObject({ expiresIn: 900 });
    });

    it('keeps students out of the instructor-only kinds', async () => {
      for (const kind of ['video', 'material', 'cover'] as const) {
        await expect(
          uploads.presignUpload(asAuthUser(student), {
            kind,
            fileName: 'file',
            mimeType: kind === 'cover' ? 'image/png' : 'application/pdf',
            fileSize: 1024,
          }),
        ).rejects.toBeInstanceOf(UploadKindNotAllowedException);
      }

      // Avatars and slips are for everyone.
      const slip = await uploads.presignUpload(asAuthUser(student), {
        kind: 'slip',
        fileName: 'slip.png',
        mimeType: 'image/png',
        fileSize: 1024,
      });
      expect(slip.fileKey.startsWith(`slip/${student.id}/`)).toBe(true);
    });

    // -----------------------------------------------------------------------
    // Scope 2.3.2: 3 GB storage cap per course
    // -----------------------------------------------------------------------

    describe('course storage cap', () => {
      it('requires a courseId for video and material, but not for cover, avatar or slip', async () => {
        for (const kind of ['video', 'material'] as const) {
          await expect(
            uploads.presignUpload(asAuthUser(instructor), {
              kind,
              fileName: 'file',
              mimeType: kind === 'video' ? 'video/mp4' : 'application/pdf',
              fileSize: 1024,
            }),
          ).rejects.toBeInstanceOf(CourseIdRequiredForUploadException);
        }

        await expect(
          uploads.presignUpload(asAuthUser(instructor), {
            kind: 'cover',
            fileName: 'cover.jpg',
            mimeType: 'image/jpeg',
            fileSize: 1024,
          }),
        ).resolves.toBeDefined();
      });

      it('refuses a courseId that belongs to someone else', async () => {
        const otherInstructor = await createUser(prisma, { role: 'INSTRUCTOR' });

        await expect(
          uploads.presignUpload(asAuthUser(otherInstructor), {
            kind: 'video',
            fileName: 'clip.mp4',
            mimeType: 'video/mp4',
            fileSize: 1024,
            courseId,
          }),
        ).rejects.toBeInstanceOf(NotCourseOwnerException);
      });

      it('refuses an upload that would push the course over 3 GB', async () => {
        await prisma.course.update({
          where: { id: courseId },
          data: { storageUsedBytes: BigInt(COURSE_MAX_STORAGE_BYTES) - BigInt(10 * MB) },
        });

        await expect(
          uploads.presignUpload(asAuthUser(instructor), {
            kind: 'material',
            fileName: 'handout.pdf',
            mimeType: 'application/pdf',
            fileSize: 20 * MB,
            courseId,
          }),
        ).rejects.toBeInstanceOf(CourseStorageLimitExceededException);
      });

      it('allows an upload that fits exactly under the remaining space', async () => {
        await prisma.course.update({
          where: { id: courseId },
          data: { storageUsedBytes: BigInt(COURSE_MAX_STORAGE_BYTES) - BigInt(10 * MB) },
        });

        await expect(
          uploads.presignUpload(asAuthUser(instructor), {
            kind: 'material',
            fileName: 'handout.pdf',
            mimeType: 'application/pdf',
            fileSize: 10 * MB,
            courseId,
          }),
        ).resolves.toBeDefined();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Issuing read URLs
  // -------------------------------------------------------------------------

  describe('signedUrlFor', () => {
    it('never hands out a URL for a lesson video', async () => {
      await expect(
        uploads.signedUrlFor(asAuthUser(instructor), `video/${instructor.id}/clip.mp4`),
      ).rejects.toBeInstanceOf(VideoNotDownloadableException);

      // Not even for an admin, and not even for the person who uploaded it.
      await expect(
        uploads.signedUrlFor(asAuthUser(admin), `video/${instructor.id}/clip.mp4`),
      ).rejects.toBeInstanceOf(VideoNotDownloadableException);
    });

    it('rejects a key that this API could not have issued', async () => {
      for (const key of [
        'material/../../../etc/passwd',
        '/material/user/file.pdf',
        'material/user',
        'unknown-kind/user/file.pdf',
        'material//file.pdf',
      ]) {
        await expect(uploads.signedUrlFor(asAuthUser(admin), key)).rejects.toBeInstanceOf(
          InvalidFileKeyException,
        );
      }
    });

    it('keeps a transfer slip between its uploader and an admin', async () => {
      const key = `slip/${student.id}/slip.jpg`;

      await expect(uploads.signedUrlFor(asAuthUser(student), key)).resolves.toMatchObject({
        expiresIn: 3600,
      });
      await expect(uploads.signedUrlFor(asAuthUser(admin), key)).resolves.toBeDefined();
      await expect(uploads.signedUrlFor(asAuthUser(buyer), key)).rejects.toBeInstanceOf(
        FileAccessDeniedException,
      );
    });

    describe('lesson attachments', () => {
      const MATERIAL_KEY = 'material/instructor/handout.pdf';

      async function attachMaterialToLesson(isPreview: boolean): Promise<void> {
        const categoryId = await createCategory(prisma);
        const courseId = await createCourse(prisma, {
          instructorId: instructor.id,
          categoryId,
          price: '990.00',
          status: CourseStatus.PUBLISHED,
        });
        const lessonId = await createLesson(prisma, { courseId, orderIndex: 1, isPreview });
        await createMaterial(prisma, { lessonId, fileKey: MATERIAL_KEY });
        await enrol(prisma, { courseId, studentId: buyer.id });
      }

      it('is readable by the owner, an admin and anyone enrolled', async () => {
        await attachMaterialToLesson(false);

        for (const user of [instructor, admin, buyer]) {
          await expect(uploads.signedUrlFor(asAuthUser(user), MATERIAL_KEY)).resolves.toBeDefined();
        }
      });

      it('is refused to a signed-in visitor who has not bought the course', async () => {
        await attachMaterialToLesson(false);

        await expect(
          uploads.signedUrlFor(asAuthUser(student), MATERIAL_KEY),
        ).rejects.toBeInstanceOf(FileAccessDeniedException);
      });

      it('is open to everyone when the lesson is a free preview', async () => {
        await attachMaterialToLesson(true);

        await expect(
          uploads.signedUrlFor(asAuthUser(student), MATERIAL_KEY),
        ).resolves.toBeDefined();
      });

      it('lets an uploader read a file not yet attached to any lesson', async () => {
        const orphan = `material/${instructor.id}/draft.pdf`;

        await expect(uploads.signedUrlFor(asAuthUser(instructor), orphan)).resolves.toBeDefined();
        await expect(uploads.signedUrlFor(asAuthUser(student), orphan)).rejects.toBeInstanceOf(
          FileAccessDeniedException,
        );
      });
    });
  });
});
