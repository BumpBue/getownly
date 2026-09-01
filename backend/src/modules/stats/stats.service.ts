import { Injectable } from '@nestjs/common';
import { CourseStatus } from '@prisma/client';
import { PrismaService } from '@/infra/prisma.service';

export interface PublicStatsDto {
  courseCount: number;
  studentCount: number;
}

/**
 * The landing page's "trust" numbers. Both come straight from the database
 * on every request - CLAUDE.md forbids a hardcoded placeholder here, and
 * there is little enough data that a live count is cheap.
 */
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async publicStats(): Promise<PublicStatsDto> {
    const [courseCount, enrolledStudents] = await Promise.all([
      this.prisma.course.count({ where: { status: CourseStatus.PUBLISHED } }),
      this.prisma.enrollment.groupBy({ by: ['studentId'] }),
    ]);

    return { courseCount, studentCount: enrolledStudents.length };
  }
}
