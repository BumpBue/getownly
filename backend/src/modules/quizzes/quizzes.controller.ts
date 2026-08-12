import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CreateQuizDto, SubmitQuizDto, UpdateQuizDto } from './dto/quiz-request.dto';
import type {
  QuizAttemptHistoryDto,
  QuizDto,
  QuizResultDto,
  QuizTakeDto,
} from './dto/quiz-response.dto';
import { QuizzesService } from './quizzes.service';

/**
 * Quizzes are addressed through their lesson when being created — that is what
 * identifies them, since a lesson holds at most one — and directly by id after
 * that.
 *
 * The student routes carry no `@Roles`, which means the default applies: signed
 * in, whoever you are. What actually gates them is the enrolment check inside
 * the service, so an instructor who bought somebody else's course can sit its
 * quizzes like anyone who paid.
 */
@Controller()
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  // --- instructor ----------------------------------------------------------

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Post('lessons/:id/quiz')
  create(
    @Param('id') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuizDto,
  ): Promise<QuizDto> {
    return this.quizzes.create(lessonId, user, dto);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Patch('quizzes/:id')
  update(
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateQuizDto,
  ): Promise<QuizDto> {
    return this.quizzes.update(quizId, user, dto);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Delete('quizzes/:id')
  remove(
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ message: string }> {
    return this.quizzes.remove(quizId, user);
  }

  // --- student -------------------------------------------------------------

  /** The paper. Contains no answer key — see QuizTakeDto. */
  @Get('quizzes/:id/take')
  take(@Param('id') quizId: string, @CurrentUser() user: AuthenticatedUser): Promise<QuizTakeDto> {
    return this.quizzes.take(quizId, user.id);
  }

  @Post('quizzes/:id/submit')
  submit(
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitQuizDto,
  ): Promise<QuizResultDto> {
    return this.quizzes.submit(quizId, user.id, dto);
  }

  @Get('quizzes/:id/attempts/mine')
  myAttempts(
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuizAttemptHistoryDto> {
    return this.quizzes.listMyAttempts(quizId, user.id);
  }
}
