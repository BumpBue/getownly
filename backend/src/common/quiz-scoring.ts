/**
 * Whether a quiz attempt passed, and what a student's standing on a quiz is.
 *
 * One place, for the same reason `courseProgressPercent` is one place: the
 * verdict is quoted on four different screens — the classroom lesson list, the
 * quiz page, the attempt history, and the instructor's roster — and any of
 * them disagreeing would be a bug nobody could reproduce.
 *
 * The rule that matters: an attempt is judged against the pass mark that
 * applied **when it was sat** (`QuizAttempt.passScoreSnapshot`), never against
 * `Quiz.passScore` as it stands now. An instructor may raise the bar after the
 * fact, and a student who cleared the old one did clear it.
 */

/** The verdict on a single attempt. */
export function isPassingScore(score: number, passScoreSnapshot: number): boolean {
  return score >= passScoreSnapshot;
}

export interface QuizStanding {
  /** Highest score across every attempt, or null if never sat. */
  bestScore: number | null;
  /**
   * Whether any attempt cleared the bar that applied to it.
   *
   * Deliberately not "best score beats the current pass mark". Once the bar
   * can move, those two stop agreeing: a student who scored 65 when 60 was
   * the mark has passed, and raising it to 70 afterwards does not un-pass
   * them — while a fresh 65 under the new mark has not passed. Keeping the
   * highest score and the verdict as two separate facts is the only way both
   * stay true.
   */
  hasPassed: boolean;
  attemptCount: number;
}

/** Rolls a student's attempts on one quiz into the standing every screen shows. */
export function summariseAttempts(
  attempts: { score: number; passScoreSnapshot: number }[],
): QuizStanding {
  if (attempts.length === 0) {
    return { bestScore: null, hasPassed: false, attemptCount: 0 };
  }

  return {
    bestScore: attempts.reduce((best, attempt) => Math.max(best, attempt.score), 0),
    hasPassed: attempts.some((attempt) => isPassingScore(attempt.score, attempt.passScoreSnapshot)),
    attemptCount: attempts.length,
  };
}
