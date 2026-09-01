import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infra/prisma.service';
import { StorageService } from '@/infra/storage/storage.service';
import type { MyEnrollmentDto } from './dto/enrollment-response.dto';

/**
 * The read side of "what have I bought". Buying itself lives in
 * {@link WalletService}, because it moves money and must stay in one
 * transaction with the ledger.
 */
@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Everything this student owns, newest purchase first. */
  async listMine(studentId: string): Promise<MyEnrollmentDto[]> {
    const rows = await this.prisma.enrollment.findMany({
      where: { studentId },
      orderBy: { enrolledAt: 'desc' },
      select: {
        id: true,
        pricePaid: true,
        enrolledAt: true,
        course: {
          select: {
            id: true,
            title: true,
            coverKey: true,
            instructor: { select: { displayName: true } },
            lessons: { select: { durationSec: true } },
          },
        },
        // Every row, not just completed ones — a watched-but-unfinished
        // lesson still counts as "recent activity" for lastActivityAt below.
        progress: {
          select: { completedAt: true, updatedAt: true },
        },
      },
    });

    return Promise.all(
      rows.map(async (row): Promise<MyEnrollmentDto> => {
        const lessonCount = row.course.lessons.length;
        const completedLessonCount = row.progress.filter((p) => p.completedAt !== null).length;
        const lastProgressAt = row.progress.reduce<Date | null>(
          (latest, p) => (latest === null || p.updatedAt > latest ? p.updatedAt : latest),
          null,
        );

        return {
          id: row.id,
          pricePaid: row.pricePaid.toFixed(2),
          enrolledAt: row.enrolledAt.toISOString(),
          courseId: row.course.id,
          courseTitle: row.course.title,
          coverUrl: await this.storage.presignGetOrNull(row.course.coverKey),
          instructorName: row.course.instructor.displayName,
          lessonCount,
          completedLessonCount,
          progressPercent:
            lessonCount === 0 ? 0 : Math.round((completedLessonCount / lessonCount) * 100),
          totalDurationSec: row.course.lessons.reduce(
            (total, lesson) => total + (lesson.durationSec ?? 0),
            0,
          ),
          lastActivityAt: (lastProgressAt ?? row.enrolledAt).toISOString(),
        };
      }),
    );
  }
}
