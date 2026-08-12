import { apiRequest } from "@/lib/api-client";
import type { PaginatedInstructorQna, PaginatedQnaThreads, QnaFilter, QnaThread } from "./types";

/** Thin wrappers over the Q&A endpoints. */

export function listCourseQna(
  courseId: string,
  options: { filter?: QnaFilter; search?: string; page?: number } = {},
): Promise<PaginatedQnaThreads> {
  const params = new URLSearchParams();
  if (options.filter && options.filter !== "all") {
    params.set("filter", options.filter);
  }
  if (options.search) {
    params.set("search", options.search);
  }
  params.set("page", String(options.page ?? 1));

  return apiRequest<PaginatedQnaThreads>(`/courses/${courseId}/qna?${params.toString()}`);
}

export function askQuestion(
  courseId: string,
  input: { title: string; body: string; lessonId?: string },
): Promise<QnaThread> {
  return apiRequest<QnaThread>(`/courses/${courseId}/qna`, { method: "POST", body: input });
}

export function getQnaThread(threadId: string): Promise<QnaThread> {
  return apiRequest<QnaThread>(`/qna/${threadId}`);
}

/** Returns the whole thread, so the conversation on screen is never a guess. */
export function replyToThread(threadId: string, body: string): Promise<QnaThread> {
  return apiRequest<QnaThread>(`/qna/${threadId}/replies`, { method: "POST", body: { body } });
}

export function setThreadResolved(threadId: string, isResolved: boolean): Promise<QnaThread> {
  return apiRequest<QnaThread>(`/qna/${threadId}/resolve`, {
    method: "PATCH",
    body: { isResolved },
  });
}

export function deleteQnaThread(threadId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/qna/${threadId}`, { method: "DELETE" });
}

export function listPendingQna(
  options: { search?: string; page?: number } = {},
): Promise<PaginatedInstructorQna> {
  const params = new URLSearchParams();
  if (options.search) {
    params.set("search", options.search);
  }
  params.set("page", String(options.page ?? 1));

  return apiRequest<PaginatedInstructorQna>(`/instructor/qna/pending?${params.toString()}`);
}
