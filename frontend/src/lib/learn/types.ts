/**
 * The classroom and quiz shapes the API returns.
 *
 * Mirrors backend/src/modules/learn/dto/learn-response.dto.ts and
 * backend/src/modules/quizzes/dto/quiz-response.dto.ts. When one side changes,
 * change the other in the same commit — the arrangement lib/catalog/types.ts
 * and lib/wallet/types.ts already use.
 *
 * Note what `QuizTakeQuestion` does not have: `isCorrect`. The answer key stays
 * on the server until an attempt is graded, so there is nothing to leak into a
 * devtools panel while the quiz is open.
 */

export interface LessonQuizSummary {
  id: string;
  title: string;
  passScore: number;
  questionCount: number;
  bestScore: number | null;
  hasPassed: boolean;
  attemptCount: number;
}

export interface LearnLessonSummary {
  id: string;
  title: string;
  orderIndex: number;
  durationSec: number | null;
  hasVideo: boolean;
  materialCount: number;
  isCompleted: boolean;
  lastPositionSec: number;
  quiz: LessonQuizSummary | null;
}

export interface CourseProgress {
  lessonCount: number;
  completedLessonCount: number;
  progressPercent: number;
}

export interface LearnRoom extends CourseProgress {
  courseId: string;
  courseTitle: string;
  instructorName: string;
  coverUrl: string | null;
  totalDurationSec: number;
  enrolledAt: string;
  resumeLessonId: string | null;
  lessons: LearnLessonSummary[];
}

export interface LearnMaterial {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl: string | null;
}

export interface LessonProgress {
  lessonId: string;
  lastPositionSec: number;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface LearnLesson {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  orderIndex: number;
  durationSec: number | null;
  /** Path into the API, e.g. "/lessons/<id>/stream". Never a link to storage. */
  videoStreamUrl: string | null;
  materials: LearnMaterial[];
  quiz: LessonQuizSummary | null;
  progress: LessonProgress;
  prevLessonId: string | null;
  nextLessonId: string | null;
}

export interface ProgressResult {
  progress: LessonProgress;
  course: CourseProgress;
}

// --- quizzes ----------------------------------------------------------------

export interface QuizTakeChoice {
  id: string;
  choiceText: string;
  orderIndex: number;
}

export interface QuizTakeQuestion {
  id: string;
  questionText: string;
  orderIndex: number;
  choices: QuizTakeChoice[];
}

export interface QuizTake {
  id: string;
  lessonId: string;
  courseId: string;
  lessonTitle: string;
  title: string;
  passScore: number;
  questionCount: number;
  bestScore: number | null;
  hasPassed: boolean;
  attemptCount: number;
  questions: QuizTakeQuestion[];
}

/** Only ever seen after grading, which is why it carries the answer key. */
export interface QuizChoice extends QuizTakeChoice {
  isCorrect: boolean;
}

export interface QuizReviewQuestion {
  id: string;
  questionText: string;
  orderIndex: number;
  selectedChoiceId: string;
  correctChoiceId: string;
  isCorrect: boolean;
  choices: QuizChoice[];
}

export interface QuizResult {
  attemptId: string;
  quizId: string;
  lessonId: string;
  courseId: string;
  quizTitle: string;
  /** The bar *this attempt* was judged against, not the quiz's current one. */
  passScore: number;
  score: number;
  passed: boolean;
  correctCount: number;
  questionCount: number;
  attemptedAt: string;
  questions: QuizReviewQuestion[];
}

export interface QuizAttemptSummary {
  id: string;
  attemptNo: number;
  score: number;
  passed: boolean;
  /** The bar this attempt faced, which the instructor may have changed since. */
  passScore: number;
  attemptedAt: string;
}

export interface QuizAttemptHistory {
  quizId: string;
  lessonId: string;
  courseId: string;
  quizTitle: string;
  /** The bar the *next* attempt will face. */
  passScore: number;
  questionCount: number;
  bestScore: number | null;
  /** Whether any attempt ever cleared the bar that applied to it. */
  hasPassed: boolean;
  attemptCount: number;
  attempts: QuizAttemptSummary[];
  latestResult: QuizResult | null;
}

/**
 * How much of a video counts as having watched it.
 *
 * Credits end on end: nobody sits through them, and a lesson that can only be
 * completed at 100% would leave students one bar short forever.
 */
export const COMPLETION_RATIO = 0.9;

/** How often the player reports its position while a video plays, in ms. */
export const PROGRESS_SAVE_INTERVAL_MS = 10_000;
