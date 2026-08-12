import { Module } from '@nestjs/common';
import { AdminCoursesController } from './admin-courses.controller';
import { CourseAccessService } from './course-access.service';
import { CourseReviewService } from './course-review.service';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

/**
 * CourseAccessService is exported because ownership and enrolment are asked
 * about from outside this module too (lessons, materials, uploads). Keeping
 * one implementation means one place to get the rule right.
 */
@Module({
  controllers: [CoursesController, AdminCoursesController],
  providers: [CoursesService, CourseAccessService, CourseReviewService],
  exports: [CourseAccessService],
})
export class CoursesModule {}
