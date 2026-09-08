import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  QuizAlreadyExistsException,
  QuizAnswerMismatchException,
  QuizHasAttemptsException,
  QuizNotFoundException,
  QuizQuestionInvalidException,
} from '@/common/exceptions/learning.exceptions';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PrismaService } from '@/infra/prisma.service';
import { isPassingScore, summariseAttempts, type QuizStanding } from '@/common/quiz-scoring';
import { CourseAccessService } from '@/modules/courses/course-access.service';
import type {
  CreateQuizDto,
  QuizAnswerInputDto,
  QuizQuestionInputDto,
  SubmitQuizDto,
  UpdateQuizDto,
} from './dto/quiz-request.dto';
import type {
  QuizAttemptHistoryDto,
  QuizDto,
  QuizResultDto,
  QuizTakeDto,
} from './dto/quiz-response.dto';

/** How many past attempts the history endpoint returns. Retakes are unlimited. */
const MAX_HISTORY_ROWS = 20;

/** The quiz with everything needed to grade it or to show it to its author. */
const fullQuizSelect = {
  id: true,
  lessonId: true,
  title: true,
  passScore: true,
  createdAt: true,
  lesson: { select: { courseId: true, title: true } },
  questions: {
    select: {
      id: true,
      questionText: true,
      orderIndex: true,
      choices: {
        select: { id: true, choiceText: true, orderIndex: true, isCorrect: true },
        orderBy: { orderIndex: 'asc' },
      },
    },
    orderBy: { orderIndex: 'asc' },
  },
} satisfies Prisma.QuizSelect;

type FullQuiz = Prisma.QuizGetPayload<{ select: typeof fullQuizSelect }>;

/**
 * Quizzes, on both sides of the desk.
 *
 * The instructor half is ordinary CRUD with one rule of its own: a quiz that
 * anybody has already sat is frozen. The student half has the rule that
 * matters most in this module — **grading happens here and nowhere else**. The
 * answer key never leaves the server while a quiz is being answered, so the
 * client has nothing to mark itself with even if it wanted to.
 */
@Injectable()
export class QuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
  ) {}

  // -------------------------------------------------------------------------
  // Instructor
  // -------------------------------------------------------------------------

  /** Attaches a quiz to a lesson. One lesson holds at most one. */
  async create(lessonId: string, user: AuthenticatedUser, dto: CreateQuizDto): Promise<QuizDto> {
    await this.access.assertLessonOwner(lessonId, user);
    assertOneCorrectChoicePerQuestion(dto.questions);

    const existing = await this.prisma.quiz.findUnique({
      where: { lessonId },
      select: { id: true },
    });
    if (existing) {
      throw new QuizAlreadyExistsException();
    }

    const quizId = await this.prisma.$transaction(async (tx) => {
      const quiz = await tx.quiz.create({
        data: { lessonId, title: dto.title.trim(), passScore: dto.passScore },
        select: { id: true },
      });
      await writeQuestions(tx, quiz.id, dto.questions);
      return quiz.id;
    });

    return this.readForOwner(quizId);
  }

  /**
   * Replaces the quiz.
   *
   * Sending `questions` rewrites the whole set: there is no way to edit a
   * single question, and none is needed, because a quiz stops being editable
   * the moment somebody sits it.
   */
  async update(quizId: string, user: AuthenticatedUser, dto: UpdateQuizDto): Promise<QuizDto> {
    const { quiz, attemptCount } = await this.loadOwned(quizId, user);

    if (dto.questions) {
      // Title and pass mark stay editable for a sat quiz; the paper does not.
      // A new pass mark only ever applies to attempts made after it, because
      // each attempt carries the mark it was judged against.
      if (attemptCount > 0) {
        throw new QuizHasAttemptsException(attemptCount);
      }
      assertOneCorrectChoicePerQuestion(dto.questions);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.quiz.update({
        where: { id: quiz.id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.passScore !== undefined ? { passScore: dto.passScore } : {}),
        },
      });

      if (dto.questions) {
        // Choices cascade with their question, so one delete clears both.
        await tx.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
        await writeQuestions(tx, quiz.id, dto.questions);
      }
    });

    return this.readForOwner(quiz.id);
  }

  /**
   * The quiz as its author sees it: every question, every choice, and the
   * answer key. Nothing about this shape reaches a student — that is
   * {@link take}, which is built from a type with no `isCorrect` on it.
   */
  async findOneForOwner(quizId: string, user: AuthenticatedUser): Promise<QuizDto> {
    await this.loadOwned(quizId, user);
    return this.readForOwner(quizId);
  }

  async remove(quizId: string, user: AuthenticatedUser): Promise<{ message: string }> {
    const { quiz, attemptCount } = await this.loadOwned(quizId, user);

    // Deleting takes the recorded scores with it, so a sat quiz stays.
    if (attemptCount > 0) {
      throw new QuizHasAttemptsException(attemptCount);
    }

    await this.prisma.quiz.delete({ where: { id: quiz.id } });

    return { message: 'ลบแบบทดสอบเรียบร้อยแล้ว' };
  }

  // -------------------------------------------------------------------------
  // Student
  // -------------------------------------------------------------------------

  /**
   * The paper, without the answer key.
   *
   * Every choice is mapped by hand into a shape that has no `isCorrect` field
   * to fill in. That is the whole defence: not "remember to strip it", but a
   * type that cannot carry it.
   */
  async take(quizId: string, studentId: string): Promise<QuizTakeDto> {
    const quiz = await this.loadForStudent(quizId, studentId);
    const standing = await this.readStanding(quizId, studentId);

    return {
      id: quiz.id,
      lessonId: quiz.lessonId,
      courseId: quiz.lesson.courseId,
      lessonTitle: quiz.lesson.title,
      title: quiz.title,
      passScore: quiz.passScore,
      questionCount: quiz.questions.length,
      bestScore: standing.bestScore,
      hasPassed: standing.hasPassed,
      attemptCount: standing.attemptCount,
      questions: quiz.questions.map((question) => ({
        id: question.id,
        questionText: question.questionText,
        orderIndex: question.orderIndex,
        choices: question.choices.map((choice) => ({
          id: choice.id,
          choiceText: choice.choiceText,
          orderIndex: choice.orderIndex,
        })),
      })),
    };
  }

  /**
   * Grades a submission and records it.
   *
   * Nothing the client sends is trusted beyond "which choice did you tick":
   * the pass mark, the answer key and the arithmetic all come from the
   * database (CLAUDE.md, ข้อห้าม 7). Every attempt is kept — the best one is
   * what counts — so there is no quota to check.
   */
  async submit(quizId: string, studentId: string, dto: SubmitQuizDto): Promise<QuizResultDto> {
    const quiz = await this.loadForStudent(quizId, studentId);
    const selections = matchAnswersToQuiz(quiz, dto.answers);

    let correctCount = 0;
    for (const question of quiz.questions) {
      const chosen = selections.get(question.id);
      if (question.choices.some((choice) => choice.id === chosen && choice.isCorrect)) {
        correctCount += 1;
      }
    }

    // Every question weighs the same. Math.round is half-up for positives,
    // which is the direction a student would expect on a borderline mark.
    const score = Math.round((correctCount / quiz.questions.length) * 100);

    // The bar in force right now is both applied and written down. From here
    // on nothing re-derives this verdict from Quiz.passScore, which the
    // instructor may move afterwards (ทก.01 A7).
    const passScoreSnapshot = quiz.passScore;
    const passed = isPassingScore(score, passScoreSnapshot);

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        studentId,
        score,
        passed,
        passScoreSnapshot,
        answers: {
          create: quiz.questions.map((question) => ({
            questionId: question.id,
            // Present for every question: matchAnswersToQuiz already refused
            // a submission with a gap in it.
            choiceId: selections.get(question.id) as string,
          })),
        },
      },
      select: { id: true, attemptedAt: true },
    });

    return buildResult(quiz, {
      attemptId: attempt.id,
      attemptedAt: attempt.attemptedAt,
      score,
      passed,
      passScoreSnapshot,
      correctCount,
      selections,
    });
  }

  /** Every attempt this student has made, newest first, plus the latest review. */
  async listMyAttempts(quizId: string, studentId: string): Promise<QuizAttemptHistoryDto> {
    const quiz = await this.loadForStudent(quizId, studentId);

    const attempts = await this.prisma.quizAttempt.findMany({
      where: { quizId, studentId },
      // `id` breaks ties: two attempts saved in the same millisecond must not
      // swap places between reads, the same reasoning as GET /wallet.
      orderBy: [{ attemptedAt: 'desc' }, { id: 'desc' }],
      take: MAX_HISTORY_ROWS,
      select: {
        id: true,
        score: true,
        passed: true,
        passScoreSnapshot: true,
        attemptedAt: true,
        answers: { select: { questionId: true, choiceId: true } },
      },
    });

    const attemptCount = await this.prisma.quizAttempt.count({ where: { quizId, studentId } });
    // Summarised from the rows above, each carrying the bar it was sat under.
    const standing = summariseAttempts(attempts);
    const latest = attempts[0];

    return {
      quizId: quiz.id,
      lessonId: quiz.lessonId,
      courseId: quiz.lesson.courseId,
      quizTitle: quiz.title,
      passScore: quiz.passScore,
      questionCount: quiz.questions.length,
      bestScore: standing.bestScore,
      hasPassed: standing.hasPassed,
      attemptCount,
      attempts: attempts.map((attempt, index) => ({
        id: attempt.id,
        // Newest first, so the first row carries the highest number.
        attemptNo: attemptCount - index,
        score: attempt.score,
        passed: attempt.passed,
        // Carried per row so a history spanning a change of pass mark can
        // show why two equal scores were judged differently.
        passScore: attempt.passScoreSnapshot,
        attemptedAt: attempt.attemptedAt.toISOString(),
      })),
      latestResult: latest
        ? buildResult(quiz, {
            attemptId: latest.id,
            attemptedAt: latest.attemptedAt,
            score: latest.score,
            passed: latest.passed,
            passScoreSnapshot: latest.passScoreSnapshot,
            correctCount: countCorrect(quiz, latest.answers),
            selections: new Map(latest.answers.map((a) => [a.questionId, a.choiceId])),
          })
        : null,
    };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** Loads a quiz and proves the caller owns the course it belongs to. */
  /**
   * Loads a quiz the caller owns, and counts how many times it has been sat.
   *
   * The count is returned rather than acted on, because what it forbids
   * depends on the caller (ทก.01 A7): the title and the pass mark may always
   * be changed, while the questions, the choices and the answer key freeze the
   * moment anybody sits it — rewriting them would leave recorded scores
   * describing a paper that no longer exists, and the database refuses it
   * anyway through QuizAttemptAnswer's RESTRICT on questionId.
   */
  private async loadOwned(
    quizId: string,
    user: AuthenticatedUser,
  ): Promise<{ quiz: FullQuiz; attemptCount: number }> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: fullQuizSelect,
    });

    if (!quiz) {
      throw new QuizNotFoundException();
    }

    await this.access.assertLessonOwner(quiz.lessonId, user);

    const attemptCount = await this.prisma.quizAttempt.count({ where: { quizId } });

    return { quiz, attemptCount };
  }

  /** Loads a quiz and proves the caller has bought the course it belongs to. */
  private async loadForStudent(quizId: string, studentId: string): Promise<FullQuiz> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: fullQuizSelect,
    });

    if (!quiz) {
      throw new QuizNotFoundException();
    }

    await this.access.assertEnrolled(quiz.lesson.courseId, studentId);

    return quiz;
  }

  private async readForOwner(quizId: string): Promise<QuizDto> {
    const quiz = await this.prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      select: fullQuizSelect,
    });
    const attemptCount = await this.prisma.quizAttempt.count({ where: { quizId } });

    return {
      id: quiz.id,
      lessonId: quiz.lessonId,
      courseId: quiz.lesson.courseId,
      title: quiz.title,
      passScore: quiz.passScore,
      questionCount: quiz.questions.length,
      attemptCount,
      createdAt: quiz.createdAt.toISOString(),
      questions: quiz.questions.map((question) => ({
        id: question.id,
        questionText: question.questionText,
        orderIndex: question.orderIndex,
        choices: question.choices.map((choice) => ({
          id: choice.id,
          choiceText: choice.choiceText,
          orderIndex: choice.orderIndex,
          isCorrect: choice.isCorrect,
        })),
      })),
    };
  }

  /**
   * This student's standing on one quiz, judged attempt by attempt against the
   * bar each was sat under rather than against the quiz's current pass mark.
   */
  private async readStanding(quizId: string, studentId: string): Promise<QuizStanding> {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { quizId, studentId },
      select: { score: true, passScoreSnapshot: true },
    });

    return summariseAttempts(attempts);
  }
}

// ---------------------------------------------------------------------------
// Rules and mappers
// ---------------------------------------------------------------------------

/**
 * Refuses a question that has no right answer, or more than one.
 *
 * With no right answer the question can never be scored; with two, the score
 * depends on which one the student happened to pick, which is not a test.
 */
function assertOneCorrectChoicePerQuestion(questions: QuizQuestionInputDto[]): void {
  questions.forEach((question, index) => {
    const correctCount = question.choices.filter((choice) => choice.isCorrect).length;
    if (correctCount === 0) {
      throw new QuizQuestionInvalidException(index, 'NO_CORRECT_CHOICE');
    }
    if (correctCount > 1) {
      throw new QuizQuestionInvalidException(index, 'MANY_CORRECT_CHOICES');
    }

    // Two identical options are not a choice: whichever the student picks,
    // one of the two identical answers is arbitrarily wrong.
    const seen = new Set(question.choices.map((choice) => choice.choiceText.trim()));
    if (seen.size !== question.choices.length) {
      throw new QuizQuestionInvalidException(index, 'DUPLICATE_CHOICE');
    }
  });
}

/**
 * Turns the submitted answers into "question id → chosen choice id", refusing
 * anything that is not exactly one answer per question of *this* quiz.
 */
function matchAnswersToQuiz(quiz: FullQuiz, answers: QuizAnswerInputDto[]): Map<string, string> {
  const selections = new Map<string, string>();

  for (const answer of answers) {
    const question = quiz.questions.find((item) => item.id === answer.questionId);
    if (!question) {
      throw new QuizAnswerMismatchException('UNKNOWN_QUESTION');
    }
    // A choice borrowed from another question would otherwise score as wrong
    // rather than as the malformed submission it is.
    if (!question.choices.some((choice) => choice.id === answer.choiceId)) {
      throw new QuizAnswerMismatchException('UNKNOWN_CHOICE');
    }
    if (selections.has(answer.questionId)) {
      throw new QuizAnswerMismatchException('UNKNOWN_QUESTION');
    }
    selections.set(answer.questionId, answer.choiceId);
  }

  if (selections.size !== quiz.questions.length) {
    throw new QuizAnswerMismatchException('INCOMPLETE');
  }

  return selections;
}

function countCorrect(quiz: FullQuiz, answers: { questionId: string; choiceId: string }[]): number {
  return answers.filter((answer) =>
    quiz.questions.some((question) =>
      question.choices.some((choice) => choice.id === answer.choiceId && choice.isCorrect),
    ),
  ).length;
}

/** The marked paper: what was picked, what was right, question by question. */
function buildResult(
  quiz: FullQuiz,
  attempt: {
    attemptId: string;
    attemptedAt: Date;
    score: number;
    passed: boolean;
    /** The bar this attempt was judged against, not the quiz's current one. */
    passScoreSnapshot: number;
    correctCount: number;
    selections: Map<string, string>;
  },
): QuizResultDto {
  return {
    attemptId: attempt.attemptId,
    quizId: quiz.id,
    lessonId: quiz.lessonId,
    courseId: quiz.lesson.courseId,
    quizTitle: quiz.title,
    // The mark that decided `passed` below. Quoting the quiz's current mark
    // here would let the page say "ผ่าน" beside a bar the score never cleared.
    passScore: attempt.passScoreSnapshot,
    score: attempt.score,
    passed: attempt.passed,
    correctCount: attempt.correctCount,
    questionCount: quiz.questions.length,
    attemptedAt: attempt.attemptedAt.toISOString(),
    questions: quiz.questions.map((question) => {
      const selectedChoiceId = attempt.selections.get(question.id) ?? '';
      const correctChoiceId = question.choices.find((choice) => choice.isCorrect)?.id ?? '';

      return {
        id: question.id,
        questionText: question.questionText,
        orderIndex: question.orderIndex,
        selectedChoiceId,
        correctChoiceId,
        isCorrect: selectedChoiceId === correctChoiceId,
        choices: question.choices.map((choice) => ({
          id: choice.id,
          choiceText: choice.choiceText,
          orderIndex: choice.orderIndex,
          isCorrect: choice.isCorrect,
        })),
      };
    }),
  };
}

/** Writes a fresh set of questions and their choices, numbered from 1. */
async function writeQuestions(
  tx: Prisma.TransactionClient,
  quizId: string,
  questions: QuizQuestionInputDto[],
): Promise<void> {
  for (const [index, question] of questions.entries()) {
    const created = await tx.quizQuestion.create({
      data: {
        quizId,
        questionText: question.questionText.trim(),
        orderIndex: index + 1,
      },
      select: { id: true },
    });

    await tx.quizChoice.createMany({
      data: question.choices.map((choice, choiceIndex) => ({
        questionId: created.id,
        choiceText: choice.choiceText.trim(),
        isCorrect: choice.isCorrect,
        orderIndex: choiceIndex + 1,
      })),
    });
  }
}
