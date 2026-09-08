/**
 * Quiz shapes, split down the middle by one rule: `isCorrect` never appears in
 * anything sent while a student is still answering (PLAN.md, หัวข้อ 1.3).
 *
 *   - QuizTakeDto and its children carry no answer key at all.
 *   - QuizResultDto does, because by then the answers are already graded and
 *     the whole point of the screen is the explanation.
 *
 * The instructor's own view (QuizDto) carries it too — they wrote it.
 */

// --- what an instructor sees -----------------------------------------------

export interface QuizChoiceDto {
  id: string;
  choiceText: string;
  orderIndex: number;
  isCorrect: boolean;
}

export interface QuizQuestionDto {
  id: string;
  questionText: string;
  orderIndex: number;
  choices: QuizChoiceDto[];
}

export interface QuizDto {
  id: string;
  lessonId: string;
  courseId: string;
  title: string;
  passScore: number;
  questionCount: number;
  /** How many times this quiz has been sat, across every student. */
  attemptCount: number;
  createdAt: string;
  questions: QuizQuestionDto[];
}

// --- what a student sees while answering ------------------------------------

/** Deliberately without `isCorrect`. Do not add it here. */
export interface QuizTakeChoiceDto {
  id: string;
  choiceText: string;
  orderIndex: number;
}

export interface QuizTakeQuestionDto {
  id: string;
  questionText: string;
  orderIndex: number;
  choices: QuizTakeChoiceDto[];
}

export interface QuizTakeDto {
  id: string;
  lessonId: string;
  courseId: string;
  lessonTitle: string;
  title: string;
  passScore: number;
  questionCount: number;
  /** This student's own record, so the page can say "ทำครั้งที่ 3". */
  bestScore: number | null;
  hasPassed: boolean;
  attemptCount: number;
  questions: QuizTakeQuestionDto[];
}

// --- what a student sees afterwards -----------------------------------------

export interface QuizReviewQuestionDto {
  id: string;
  questionText: string;
  orderIndex: number;
  selectedChoiceId: string;
  correctChoiceId: string;
  isCorrect: boolean;
  choices: QuizChoiceDto[];
}

export interface QuizResultDto {
  attemptId: string;
  quizId: string;
  lessonId: string;
  courseId: string;
  quizTitle: string;
  passScore: number;
  /** Percentage, 0-100. */
  score: number;
  passed: boolean;
  correctCount: number;
  questionCount: number;
  attemptedAt: string;
  questions: QuizReviewQuestionDto[];
}

/** One line of the attempt history. */
export interface QuizAttemptSummaryDto {
  id: string;
  attemptNo: number;
  score: number;
  passed: boolean;
  attemptedAt: string;
}

export interface QuizAttemptHistoryDto {
  quizId: string;
  lessonId: string;
  courseId: string;
  quizTitle: string;
  passScore: number;
  questionCount: number;
  /** Highest score across every attempt. */
  bestScore: number | null;
  /**
   * Whether any attempt cleared the bar that applied to it — "has ever
   * passed", not "would the best score pass today". Once the pass mark can be
   * changed the two stop agreeing; see common/quiz-scoring.ts.
   */
  hasPassed: boolean;
  attemptCount: number;
  /** Newest first. */
  attempts: QuizAttemptSummaryDto[];
  /** Full review of the most recent attempt, which is what the result page shows. */
  latestResult: QuizResultDto | null;
}
