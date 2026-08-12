/**
 * The classroom shapes.
 *
 * One field is conspicuously absent everywhere: the video object key. The
 * player is handed `videoStreamUrl`, a path back into this API, never a signed
 * link to storage (CLAUDE.md, ข้อห้าม 10). Attachments are the opposite case
 * and do carry a short-lived signed URL, because a PDF the student is entitled
 * to download is meant to be downloadable.
 */

/** How the student is doing on a quiz, as summarised beside the lesson. */
export interface LessonQuizSummaryDto {
  id: string;
  title: string;
  /** Percentage needed to pass, 0-100. */
  passScore: number;
  questionCount: number;
  /** Highest percentage this student has scored, or null if never attempted. */
  bestScore: number | null;
  hasPassed: boolean;
  attemptCount: number;
}

/** One row of the lesson list in the classroom sidebar. */
export interface LearnLessonSummaryDto {
  id: string;
  title: string;
  orderIndex: number;
  durationSec: number | null;
  hasVideo: boolean;
  materialCount: number;
  isCompleted: boolean;
  /** Where the player should resume, in seconds. */
  lastPositionSec: number;
  quiz: LessonQuizSummaryDto | null;
}

/** How far through the course the student is. Derived, never stored. */
export interface CourseProgressDto {
  lessonCount: number;
  completedLessonCount: number;
  /** 0-100, rounded. 0 when the course has no lessons yet. */
  progressPercent: number;
}

export interface LearnRoomDto extends CourseProgressDto {
  courseId: string;
  courseTitle: string;
  instructorName: string;
  coverUrl: string | null;
  totalDurationSec: number;
  enrolledAt: string;
  /** Where "continue learning" should land: the first unfinished lesson. */
  resumeLessonId: string | null;
  lessons: LearnLessonSummaryDto[];
}

export interface LearnMaterialDto {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  /** Short-lived signed URL, or null when storage is unreachable. */
  downloadUrl: string | null;
}

export interface LessonProgressDto {
  lessonId: string;
  lastPositionSec: number;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface LearnLessonDto {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  orderIndex: number;
  durationSec: number | null;
  /**
   * Path into this API, e.g. "/lessons/<id>/stream". Relative on purpose: the
   * web app already knows its API base, and hardcoding a host here would break
   * the moment the API moves.
   */
  videoStreamUrl: string | null;
  materials: LearnMaterialDto[];
  quiz: LessonQuizSummaryDto | null;
  progress: LessonProgressDto;
  prevLessonId: string | null;
  nextLessonId: string | null;
}

/** What the player gets back after saving a position or finishing a lesson. */
export interface ProgressResultDto {
  progress: LessonProgressDto;
  course: CourseProgressDto;
}
