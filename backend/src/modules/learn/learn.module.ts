import { Module } from '@nestjs/common';
import { CoursesModule } from '@/modules/courses/courses.module';
import { LearnController } from './learn.controller';
import { LearnService } from './learn.service';

/** The classroom and lesson progress. Quizzes live in QuizzesModule. */
@Module({
  imports: [CoursesModule],
  controllers: [LearnController],
  providers: [LearnService],
})
export class LearnModule {}
