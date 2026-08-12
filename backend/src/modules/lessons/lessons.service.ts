import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Readable } from 'node:stream';
import {
  LessonAccessDeniedException,
  LessonHasNoVideoException,
  LessonNotFoundException,
  LessonOrderMismatchException,
  RangeNotSatisfiableException,
} from '@/common/exceptions/catalog.exceptions';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PrismaService } from '@/infra/prisma.service';
import { StorageService } from '@/infra/storage/storage.service';
import { CourseAccessService } from '@/modules/courses/course-access.service';
import type { CreateLessonDto, ReorderLessonsDto, UpdateLessonDto } from './dto/lesson-request.dto';
import type { LessonDto } from './dto/lesson-response.dto';

/**
 * Largest slice served for an open-ended range like `bytes=0-`.
 *
 * Without a cap the first request for a 500MB video would try to stream the
 * whole file, which is both slow to start and pointless when the viewer is
 * about to seek. 8MB is enough for the player to begin playback immediately.
 */
const MAX_STREAM_CHUNK_BYTES = 8 * 1024 * 1024;

const lessonSelect = {
  id: true,
  courseId: true,
  title: true,
  orderIndex: true,
  durationSec: true,
  isPreview: true,
  videoKey: true,
  createdAt: true,
  materials: {
    select: {
      id: true,
      lessonId: true,
      fileName: true,
      fileKey: true,
      fileSize: true,
      mimeType: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.LessonSelect;

type LessonRow = Prisma.LessonGetPayload<{ select: typeof lessonSelect }>;

/** Everything the controller needs to write a 200 or a 206 response. */
export interface VideoStreamSlice {
  stream: Readable;
  start: number;
  end: number;
  totalBytes: number;
  mimeType: string;
  isPartial: boolean;
}

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly access: CourseAccessService,
  ) {}

  /** The curriculum as its instructor sees it, attachments included. */
  async listForCourse(courseId: string, user: AuthenticatedUser): Promise<LessonDto[]> {
    await this.access.assertCourseOwner(courseId, user);

    const lessons = await this.prisma.lesson.findMany({
      where: { courseId },
      select: lessonSelect,
      orderBy: { orderIndex: 'asc' },
    });

    return lessons.map(toLessonDto);
  }

  /**
   * Appends a lesson to the end of the course.
   *
   * The course row is locked first because `orderIndex` is derived from the
   * current maximum: two instructors adding a lesson from two tabs at the same
   * moment would otherwise both compute the same next index and one would hit
   * the unique constraint.
   */
  async create(
    courseId: string,
    user: AuthenticatedUser,
    dto: CreateLessonDto,
  ): Promise<LessonDto> {
    await this.access.assertCourseOwner(courseId, user);

    const lesson = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Course" WHERE id = ${courseId} FOR UPDATE`;

      const highest = await tx.lesson.aggregate({
        where: { courseId },
        _max: { orderIndex: true },
      });

      return tx.lesson.create({
        data: {
          courseId,
          title: dto.title.trim(),
          orderIndex: (highest._max.orderIndex ?? 0) + 1,
          videoKey: dto.videoKey ?? null,
          durationSec: dto.durationSec ?? null,
          isPreview: dto.isPreview ?? false,
        },
        select: lessonSelect,
      });
    });

    return toLessonDto(lesson);
  }

  async update(
    lessonId: string,
    user: AuthenticatedUser,
    dto: UpdateLessonDto,
  ): Promise<LessonDto> {
    const existing = await this.access.assertLessonOwner(lessonId, user);

    const lesson = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.videoKey !== undefined ? { videoKey: dto.videoKey } : {}),
        ...(dto.durationSec !== undefined ? { durationSec: dto.durationSec } : {}),
        ...(dto.isPreview !== undefined ? { isPreview: dto.isPreview } : {}),
      },
      select: lessonSelect,
    });

    // Replacing the video leaves the old object with nothing pointing at it.
    if (dto.videoKey !== undefined && existing.videoKey && existing.videoKey !== dto.videoKey) {
      await this.storage.remove(existing.videoKey);
    }

    return toLessonDto(lesson);
  }

  /**
   * Deletes a lesson and closes the gap it leaves in the ordering.
   *
   * Refused once anyone has watched it: deleting would silently change what
   * "100% complete" means for students already partway through (PLAN.md, R17).
   */
  async remove(lessonId: string, user: AuthenticatedUser): Promise<{ message: string }> {
    const lesson = await this.access.assertLessonOwner(lessonId, user);

    const watched = await this.prisma.lessonProgress.count({ where: { lessonId } });
    if (watched > 0) {
      throw new LessonAccessDeniedException();
    }

    const materials = await this.prisma.material.findMany({
      where: { lessonId },
      select: { fileKey: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.lesson.delete({ where: { id: lessonId } });

      // Everything after it shifts up one, so indexes stay 1..N with no holes.
      await tx.$executeRaw`
        UPDATE "Lesson"
        SET "orderIndex" = "orderIndex" - 1
        WHERE "courseId" = ${lesson.courseId} AND "orderIndex" > ${lesson.orderIndex}
      `;
    });

    const orphaned = [lesson.videoKey, ...materials.map((m) => m.fileKey)].filter(
      (key): key is string => key !== null,
    );
    await Promise.all(orphaned.map((key) => this.storage.remove(key)));

    return { message: 'ลบบทเรียนเรียบร้อยแล้ว' };
  }

  /**
   * Rewrites the whole ordering from a list of ids.
   *
   * The payload must be a permutation of the course's lessons — not a subset,
   * not a superset — so a stale browser tab cannot half-apply an order.
   *
   * The write happens in two passes because `(courseId, orderIndex)` is unique:
   * moving lesson 2 into slot 1 while lesson 1 is still there would collide, so
   * every row is first parked on a negative index no real row can hold.
   */
  async reorder(
    courseId: string,
    user: AuthenticatedUser,
    dto: ReorderLessonsDto,
  ): Promise<LessonDto[]> {
    await this.access.assertCourseOwner(courseId, user);

    const current = await this.prisma.lesson.findMany({
      where: { courseId },
      select: { id: true },
    });

    const requested = new Set(dto.lessonIds);
    if (requested.size !== dto.lessonIds.length || requested.size !== current.length) {
      throw new LessonOrderMismatchException();
    }
    if (!current.every((lesson) => requested.has(lesson.id))) {
      throw new LessonOrderMismatchException();
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [index, lessonId] of dto.lessonIds.entries()) {
        await tx.lesson.update({
          where: { id: lessonId },
          data: { orderIndex: -(index + 1) },
        });
      }
      for (const [index, lessonId] of dto.lessonIds.entries()) {
        await tx.lesson.update({
          where: { id: lessonId },
          data: { orderIndex: index + 1 },
        });
      }
    });

    return this.listForCourse(courseId, user);
  }

  // -------------------------------------------------------------------------
  // Video streaming
  // -------------------------------------------------------------------------

  /**
   * Opens a slice of a lesson video for the response to pipe.
   *
   * Every call re-checks who is asking. That is the whole reason videos are
   * proxied rather than presigned: a signed URL would still work after the
   * viewer's access ended, and could be forwarded to anyone
   * (CLAUDE.md, ข้อห้าม 10).
   */
  async openVideo(
    lessonId: string,
    user: AuthenticatedUser,
    rangeHeader: string | undefined,
  ): Promise<VideoStreamSlice> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        videoKey: true,
        isPreview: true,
        courseId: true,
        course: { select: { instructorId: true } },
      },
    });

    if (!lesson) {
      throw new LessonNotFoundException();
    }

    const allowed = await this.access.canReadLessonContent(
      {
        isPreview: lesson.isPreview,
        courseId: lesson.courseId,
        instructorId: lesson.course.instructorId,
      },
      user,
    );
    if (!allowed) {
      throw new LessonAccessDeniedException();
    }

    if (!lesson.videoKey) {
      throw new LessonHasNoVideoException();
    }

    const info = await this.storage.stat(lesson.videoKey);
    if (!info) {
      throw new LessonHasNoVideoException();
    }

    const requested = parseRangeHeader(rangeHeader, info.sizeBytes);
    if (requested === 'invalid') {
      throw new RangeNotSatisfiableException(info.sizeBytes);
    }

    const start = requested?.start ?? 0;
    const end = requested?.end ?? info.sizeBytes - 1;
    const length = end - start + 1;

    return {
      stream: await this.storage.openRange(lesson.videoKey, start, length),
      start,
      end,
      totalBytes: info.sizeBytes,
      mimeType: info.mimeType,
      isPartial: requested !== null,
    };
  }
}

function toLessonDto(lesson: LessonRow): LessonDto {
  return {
    id: lesson.id,
    courseId: lesson.courseId,
    title: lesson.title,
    orderIndex: lesson.orderIndex,
    durationSec: lesson.durationSec,
    isPreview: lesson.isPreview,
    hasVideo: lesson.videoKey !== null,
    createdAt: lesson.createdAt.toISOString(),
    materials: lesson.materials.map((material) => ({
      id: material.id,
      lessonId: material.lessonId,
      fileName: material.fileName,
      fileKey: material.fileKey,
      fileSize: material.fileSize,
      mimeType: material.mimeType,
      createdAt: material.createdAt.toISOString(),
    })),
  };
}

/**
 * Reads a single-range `Range` header.
 *
 * Returns null when the client did not ask for a range (send the whole file),
 * `'invalid'` when it asked for something outside the file, and the resolved
 * byte window otherwise. Multi-range requests are treated as no range, which
 * is the behaviour HTTP allows and every browser video player copes with.
 */
export function parseRangeHeader(
  header: string | undefined,
  sizeBytes: number,
): { start: number; end: number } | 'invalid' | null {
  if (!header) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) {
    return null;
  }

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') {
    return 'invalid';
  }

  // "bytes=-500" means the last 500 bytes.
  if (rawStart === '') {
    const suffixLength = Number(rawEnd);
    if (suffixLength <= 0) {
      return 'invalid';
    }
    return { start: Math.max(0, sizeBytes - suffixLength), end: sizeBytes - 1 };
  }

  const start = Number(rawStart);
  if (start >= sizeBytes) {
    return 'invalid';
  }

  // An open-ended range is capped so the first request returns quickly instead
  // of trying to push the entire file before playback can start.
  const end =
    rawEnd === ''
      ? Math.min(sizeBytes - 1, start + MAX_STREAM_CHUNK_BYTES - 1)
      : Math.min(Number(rawEnd), sizeBytes - 1);

  if (end < start) {
    return 'invalid';
  }

  return { start, end };
}
