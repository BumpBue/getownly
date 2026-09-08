-- The single PAYOUT_PAYABLE account, in its own migration.
--
-- Postgres will not let a value added to an enum be used in the same
-- transaction that added it, and Prisma runs each migration in one, so the
-- INSERT cannot live alongside the ALTER TYPE that made the value exist.
--
-- Created here rather than left to the seed so that a database which already
-- holds real data gains the account too. Balance starts at zero, which is what
-- keeps every existing report returning exactly what it returned before.
INSERT INTO "Account" ("id", "ownerId", "kind", "balance", "createdAt")
SELECT 'account_payout_payable', NULL, 'PAYOUT_PAYABLE', 0, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "Account" WHERE "ownerId" IS NULL AND "kind" = 'PAYOUT_PAYABLE'
);
