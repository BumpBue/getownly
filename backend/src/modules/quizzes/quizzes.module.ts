import { Module } from '@nestjs/common';
import { CoursesModule } from '@/modules/courses/courses.module';
import { QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';

/** Writing quizzes, sitting them, and grading them. */
@Module({
  imports: [CoursesModule],
  controllers: [QuizzesController],
  providers: [QuizzesService],
})
export class QuizzesModule {}
