/**
 * The Q&A shapes the API returns.
 *
 * Mirrors backend/src/modules/qna/dto/qna-response.dto.ts. When one side
 * changes, change the other in the same commit — the arrangement
 * lib/learn/types.ts and lib/wallet/types.ts already use.
 *
 * Every person here is an id and a display name, and nothing else: the API
 * strips the rest before it leaves, and there is no field to put it in.
 */

export const QNA_FILTERS = ["all", "unanswered", "answered"] as const;
export type QnaFilter = (typeof QNA_FILTERS)[number];

export interface QnaAuthor {
  id: string;
  displayName: string;
}

export interface QnaReply {
  id: string;
  author: QnaAuthor;
  /** Drives the "ผู้สอน" badge and the tinted background. */
  isInstructorReply: boolean;
  body: string;
  createdAt: string;
}

export interface QnaThreadSummary {
  id: string;
  courseId: string;
  title: string;
  body: string;
  author: QnaAuthor;
  lesson: { id: string; title: string } | null;
  isResolved: boolean;
  replyCount: number;
  hasInstructorReply: boolean;
  lastReplyAt: string | null;
  createdAt: string;
}

export interface QnaThread extends QnaThreadSummary {
  courseTitle: string;
  replies: QnaReply[];
  canReply: boolean;
  canResolve: boolean;
  canDelete: boolean;
}

export interface PaginatedQnaThreads {
  items: QnaThreadSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unansweredTotal: number;
  canAsk: boolean;
  /** With `canAsk`, tells the instructor apart from an admin looking on. */
  canReply: boolean;
}

export interface InstructorQnaThread extends QnaThreadSummary {
  course: { id: string; title: string };
}

export interface PaginatedInstructorQna {
  items: InstructorQnaThread[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
