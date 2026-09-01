import { Module } from '@nestjs/common';
import { CoursesModule } from '@/modules/courses/courses.module';
import { ContentReportsController } from './content-reports.controller';
import { ContentReportsService } from './content-reports.service';

/** Reporting a course or a Q&A thread as inappropriate, and the admin queue that reviews it. */
@Module({
  imports: [CoursesModule],
  controllers: [ContentReportsController],
  providers: [ContentReportsService],
})
export class ContentReportsModule {}
