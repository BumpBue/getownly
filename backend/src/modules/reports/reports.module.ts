import { Module } from '@nestjs/common';
import { CoursesModule } from '@/modules/courses/courses.module';
import { AdminReportsController, InstructorReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * Reporting, for the platform and for one instructor. Read-only throughout.
 *
 * CoursesModule is imported for CourseAccessService, the one place that
 * answers "is this course yours" — the earnings table refuses a course filter
 * through it rather than growing an ownership check of its own.
 */
@Module({
  imports: [CoursesModule],
  controllers: [AdminReportsController, InstructorReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
