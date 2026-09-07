-- Record the pass mark each attempt was graded against (ทก.01 A7).
--
-- Until now an attempt's verdict could only be re-derived from Quiz.passScore
-- as it stands today. That was safe only because a quiz froze the moment
-- anybody sat it; now that an instructor may adjust the pass mark afterwards,
-- the bar that applied has to be written down with the attempt.

-- 1. Add it nullable, so existing rows survive the statement.
ALTER TABLE "QuizAttempt" ADD COLUMN "passScoreSnapshot" INTEGER;

-- 2. Backfill from the quiz's current pass mark.
--
-- This is exact rather than a best guess: a quiz with attempts could not be
-- edited at all, so its passScore has not moved since its first attempt was
-- graded. The current value therefore *is* the value every existing attempt
-- was judged against.
UPDATE "QuizAttempt" a
SET "passScoreSnapshot" = q."passScore"
FROM "Quiz" q
WHERE q.id = a."quizId";

-- 3. Now that every row has one, require it.
ALTER TABLE "QuizAttempt" ALTER COLUMN "passScoreSnapshot" SET NOT NULL;
