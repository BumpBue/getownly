import { Module } from '@nestjs/common';
import { CoursesModule } from '@/modules/courses/courses.module';
import { QnaController } from './qna.controller';
import { QnaService } from './qna.service';

/** Course Q&A: asking, answering, closing and moderating. */
@Module({
  imports: [CoursesModule],
  controllers: [QnaController],
  providers: [QnaService],
})
export class QnaModule {}
