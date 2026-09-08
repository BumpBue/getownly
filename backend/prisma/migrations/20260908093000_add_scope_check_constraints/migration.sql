-- Enforce the ทก.01 numeric limits in the database itself.
--
-- The DTOs already refuse these values, and they will keep doing so: this is a
-- second, independent floor, so a bad value cannot arrive through a migration,
-- a seed script, a console session or a future endpoint that forgets its DTO.
--
-- Both were verified clean before this ran: no Course outside 0-10,000 and no
-- Quiz outside 60-100 existed in either the development or the test database.
--
-- Prisma does not model CHECK constraints, so `prisma migrate dev` will not see
-- these in schema.prisma and will offer to reset the database over the drift it
-- thinks it has found. See CLAUDE.md, "CHECK constraint ที่ Prisma ไม่รู้จัก".

-- ทก.01 A4: a course is free or costs at most 10,000 baht.
ALTER TABLE "Course"
  ADD CONSTRAINT "Course_price_within_scope"
  CHECK (price >= 0 AND price <= 10000);

-- ทก.01 A7: an instructor sets the pass mark between 60 and 100.
ALTER TABLE "Quiz"
  ADD CONSTRAINT "Quiz_passScore_within_scope"
  CHECK ("passScore" >= 60 AND "passScore" <= 100);

-- Deliberately NOT constrained: "QuizAttempt"."passScoreSnapshot".
--
-- That column is history, not policy. It records the bar an attempt was
-- actually judged against, and if the allowed range is ever revised the old
-- values must survive unchanged — a constraint there would make correcting the
-- range mean rewriting the past, which is the opposite of what a snapshot is
-- for.
