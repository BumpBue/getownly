import type { MoneyString } from '@/modules/ledger/dto/ledger-response.dto';

/** One card on "คอร์สของฉัน". Built by an explicit mapper, never a raw row. */
export interface MyEnrollmentDto {
  id: string;
  /** What was actually charged at the time, not today's course price. */
  pricePaid: MoneyString;
  enrolledAt: string;

  courseId: string;
  courseTitle: string;
  /** Short-lived signed URL, or null when there is no cover / storage is down. */
  coverUrl: string | null;
  instructorName: string;

  lessonCount: number;
  completedLessonCount: number;
  /** 0-100, rounded. 0 when the course has no lessons yet. */
  progressPercent: number;
  totalDurationSec: number;
  /**
   * Latest `LessonProgress.updatedAt` across this enrollment, or `enrolledAt`
   * when nothing has been watched yet. /home's "resume learning" card uses
   * this to pick the one course actually touched most recently — enrolledAt
   * alone would pick the most recently *bought* course instead.
   */
  lastActivityAt: string;
}
