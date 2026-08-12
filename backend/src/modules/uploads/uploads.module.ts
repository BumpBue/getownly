import { Module } from '@nestjs/common';
import { CoursesModule } from '@/modules/courses/courses.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

/** Needs CoursesModule for the enrolment check behind attachment downloads. */
@Module({
  imports: [CoursesModule],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
