import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './business.exception';

// Errors raised by the classroom and the quizzes: everything that happens
// after a course has been bought.
//
// Like catalog.exceptions.ts they live in common/ because more than one module
// raises them — CourseAccessService answers "are you enrolled?" for the learn
// module and the quiz module alike.

/**
 * Owning a course is not the same as being enrolled in it.
 *
 * The classroom is deliberately strict: an instructor previewing their own
 * course has no Enrollment row, so it has nowhere to record progress. They
 * review their material through the curriculum editor instead.
 */
export class NotEnrolledException extends BusinessException {
  constructor() {
    super(HttpStatus.FORBIDDEN, 'NOT_ENROLLED', 'ต้องลงทะเบียนคอร์สนี้ก่อนจึงจะเข้าห้องเรียนได้');
  }
}

/** The lesson exists but belongs to a different course than the URL says. */
export class LessonNotInCourseException extends BusinessException {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'LESSON_NOT_IN_COURSE', 'ไม่พบบทเรียนนี้ในคอร์สที่ระบุ');
  }
}

export class QuizNotFoundException extends BusinessException {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'QUIZ_NOT_FOUND', 'ไม่พบแบบทดสอบที่ระบุ');
  }
}

/** One lesson holds at most one quiz — the schema's unique constraint, stated in Thai. */
export class QuizAlreadyExistsException extends BusinessException {
  constructor() {
    super(
      HttpStatus.CONFLICT,
      'QUIZ_ALREADY_EXISTS',
      'บทเรียนนี้มีแบบทดสอบอยู่แล้ว หากต้องการเปลี่ยนให้แก้ไขชุดเดิม',
    );
  }
}

/**
 * Refuses to rewrite a quiz people have already sat.
 *
 * Editing the questions would silently change what a past score meant, the
 * same reasoning that blocks deleting a watched lesson (PLAN.md, R17).
 */
export class QuizHasAttemptsException extends BusinessException {
  constructor(attemptCount: number) {
    super(
      HttpStatus.CONFLICT,
      'QUIZ_HAS_ATTEMPTS',
      'มีผู้เรียนทำแบบทดสอบชุดนี้ไปแล้ว จึงแก้ไขหรือลบไม่ได้',
      { attemptCount },
    );
  }
}

/**
 * A lesson cannot be deleted out from under a quiz somebody has sat.
 *
 * `QuizAttemptAnswer.questionId` is RESTRICT, so the database refuses the
 * delete regardless — but it refuses with a raw foreign key violation that the
 * exception filter can only turn into a 500. This says the same thing in a
 * sentence the instructor can act on.
 */
export class LessonQuizHasAttemptsException extends BusinessException {
  constructor(attemptCount: number) {
    super(
      HttpStatus.CONFLICT,
      'LESSON_QUIZ_HAS_ATTEMPTS',
      `มีผู้เรียนทำแบบทดสอบของบทเรียนนี้ไปแล้ว ${attemptCount} ครั้ง จึงลบบทเรียนไม่ได้ ` +
        'เพราะคะแนนที่บันทึกไว้จะหายไปด้วย',
      { attemptCount },
    );
  }
}

/** Every question needs exactly one right answer for the score to mean anything. */
export type QuizQuestionProblem = 'NO_CORRECT_CHOICE' | 'MANY_CORRECT_CHOICES' | 'DUPLICATE_CHOICE';

const QUIZ_QUESTION_PROBLEM_MESSAGE: Record<QuizQuestionProblem, string> = {
  NO_CORRECT_CHOICE: 'ยังไม่ได้เลือกว่าตัวเลือกใดเป็นคำตอบที่ถูก',
  MANY_CORRECT_CHOICES: 'เลือกคำตอบที่ถูกไว้มากกว่าหนึ่งตัวเลือก',
  DUPLICATE_CHOICE: 'มีตัวเลือกที่ข้อความซ้ำกัน',
};

/**
 * Something is wrong with one specific question.
 *
 * The message names the question by its position, because a form with ten
 * questions on it and an error reading "ข้อมูลไม่ถูกต้อง" tells the instructor
 * nothing they can act on. `questionIndex` travels in `details` so the web app
 * can scroll to and highlight the offending card.
 */
export class QuizQuestionInvalidException extends BusinessException {
  constructor(questionIndex: number, problem: QuizQuestionProblem) {
    super(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'QUIZ_QUESTION_INVALID',
      `ข้อที่ ${questionIndex + 1}: ${QUIZ_QUESTION_PROBLEM_MESSAGE[problem]}`,
      { questionIndex, problem },
    );
  }
}

/**
 * The submitted answers are not one choice per question of this quiz.
 *
 * Covers a missing answer, a duplicate answer and a choice copied from another
 * question — all of which would make the score arithmetic meaningless.
 */
export class QuizAnswerMismatchException extends BusinessException {
  constructor(reason: 'INCOMPLETE' | 'UNKNOWN_QUESTION' | 'UNKNOWN_CHOICE') {
    super(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'QUIZ_ANSWER_MISMATCH',
      reason === 'INCOMPLETE'
        ? 'กรุณาตอบให้ครบทุกข้อก่อนส่งคำตอบ'
        : 'คำตอบที่ส่งมาไม่ตรงกับข้อสอบชุดนี้',
      { reason },
    );
  }
}
