/**
 * The Q&A shapes.
 *
 * Every user that appears here is reduced to an id and a display name by an
 * explicit mapper. A thread joins to its author and every reply joins to its
 * writer, and none of those rows may travel whole — a Q&A board is the easiest
 * place in the system to leak a classmate's email address (CLAUDE.md, ข้อห้าม 11).
 */

export interface QnaAuthorDto {
  id: string;
  displayName: string;
}

export interface QnaReplyDto {
  id: string;
  author: QnaAuthorDto;
  /**
   * True when the writer owns the course. Derived from the course's current
   * instructor rather than stored on the row: a stored flag is a second copy
   * of a fact the join already knows, and copies drift.
   */
  isInstructorReply: boolean;
  body: string;
  createdAt: string;
}

/** One row of the board. */
export interface QnaThreadSummaryDto {
  id: string;
  courseId: string;
  title: string;
  body: string;
  author: QnaAuthorDto;
  /** The lesson the question was asked from, when it was asked from one. */
  lesson: { id: string; title: string } | null;
  isResolved: boolean;
  replyCount: number;
  /** Drives the green "ผู้สอนตอบแล้ว" badge against the amber "รอคำตอบ". */
  hasInstructorReply: boolean;
  lastReplyAt: string | null;
  createdAt: string;
}

export interface QnaThreadDto extends QnaThreadSummaryDto {
  courseTitle: string;
  replies: QnaReplyDto[];
  /** What the viewer may do here, so the screen shows only the buttons that work. */
  canReply: boolean;
  canResolve: boolean;
  canDelete: boolean;
}

export interface PaginatedQnaThreadsDto {
  items: QnaThreadSummaryDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  /** Count for the "รอคำตอบ" tab, whatever the current filter is. */
  unansweredTotal: number;
  /** False for the instructor and for admins, who read the board but do not ask. */
  canAsk: boolean;
  /**
   * True for enrolled students and the instructor. Together with `canAsk` it
   * tells the three audiences apart, so the notice above the board says the
   * right thing to each without the client guessing from a role.
   */
  canReply: boolean;
}

/** A pending question as the instructor's inbox lists it: with its course. */
export interface InstructorQnaThreadDto extends QnaThreadSummaryDto {
  course: { id: string; title: string };
}

export interface PaginatedInstructorQnaDto {
  items: InstructorQnaThreadDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
