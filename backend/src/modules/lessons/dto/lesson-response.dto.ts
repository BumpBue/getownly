/**
 * The instructor's view of a lesson. Still no `videoKey`: the editor only ever
 * needs to know whether a video is attached, and the player uses the streaming
 * endpoint, so the key has no reason to be in any response.
 */
export interface LessonDto {
  id: string;
  courseId: string;
  title: string;
  orderIndex: number;
  durationSec: number | null;
  isPreview: boolean;
  hasVideo: boolean;
  materials: MaterialDto[];
  /** The quiz on this lesson, if it has one. At most one, ever. */
  quiz: LessonQuizSummaryDto | null;
  createdAt: string;
}

/**
 * Enough for the authoring screen to list a lesson's quiz and decide what may
 * still be changed about it, without loading every question.
 */
export interface LessonQuizSummaryDto {
  id: string;
  title: string;
  passScore: number;
  questionCount: number;
  /**
   * How many times it has been sat. Above zero the questions freeze, so the
   * form needs this to explain why rather than just disabling fields.
   */
  attemptCount: number;
}

export interface MaterialDto {
  id: string;
  lessonId: string;
  fileName: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}
