/**
 * How far through a course somebody is.
 *
 * One formula, in one place, because three different screens quote it at the
 * same person: the classroom the student is sitting in, the "my courses" list
 * they came from, and the roster their instructor reads (ทก.01 A9). A student
 * who sees 40% and an instructor who sees 39% for the same enrolment would be
 * a bug nobody could reproduce, so there is nowhere else to write it down.
 *
 * Completion is a lesson-level fact — `LessonProgress.completedAt` being set —
 * not a fraction of video watched. The 90%-watched rule that decides *when* to
 * set it lives in the web app (frontend/src/lib/learn/types.ts); by the time a
 * number reaches here the decision has already been made and recorded.
 */

/** 0 rather than NaN for a course that has no lessons yet. */
export function courseProgressPercent(completedLessonCount: number, lessonCount: number): number {
  return lessonCount === 0 ? 0 : Math.round((completedLessonCount / lessonCount) * 100);
}
