import { apiRequest } from "@/lib/api-client";
import type {
  LearnLesson,
  LearnRoom,
  ProgressResult,
  QuizAttemptHistory,
  QuizResult,
  QuizTake,
} from "./types";

/** Thin wrappers over the classroom and quiz endpoints. */

// --- classroom --------------------------------------------------------------

export function getLearnRoom(courseId: string): Promise<LearnRoom> {
  return apiRequest<LearnRoom>(`/learn/${courseId}`);
}

export function getLearnLesson(courseId: string, lessonId: string): Promise<LearnLesson> {
  return apiRequest<LearnLesson>(`/learn/${courseId}/lessons/${lessonId}`);
}

/** Fired on a timer while a video plays, so it is kept to one integer. */
export function saveProgress(lessonId: string, lastPositionSec: number): Promise<ProgressResult> {
  return apiRequest<ProgressResult>(`/progress/${lessonId}`, {
    method: "PATCH",
    body: { lastPositionSec },
  });
}

export function completeLesson(lessonId: string): Promise<ProgressResult> {
  return apiRequest<ProgressResult>(`/progress/${lessonId}/complete`, { method: "POST" });
}

// --- quizzes ----------------------------------------------------------------

export function getQuizPaper(quizId: string): Promise<QuizTake> {
  return apiRequest<QuizTake>(`/quizzes/${quizId}/take`);
}

/**
 * Sends the ticked choices and gets back a marked paper.
 *
 * The score is decided entirely by the API. Nothing here can influence it, and
 * nothing here knew the answers before this call returned.
 */
export function submitQuiz(
  quizId: string,
  answers: { questionId: string; choiceId: string }[],
): Promise<QuizResult> {
  return apiRequest<QuizResult>(`/quizzes/${quizId}/submit`, {
    method: "POST",
    body: { answers },
  });
}

export function getMyQuizAttempts(quizId: string): Promise<QuizAttemptHistory> {
  return apiRequest<QuizAttemptHistory>(`/quizzes/${quizId}/attempts/mine`);
}
