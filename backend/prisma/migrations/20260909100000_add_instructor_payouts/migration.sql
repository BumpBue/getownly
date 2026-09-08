-- Instructor payouts. An extension beyond ทก.01; see SCOPE_COMPLIANCE.md.
--
-- Money leaves an instructor's wallet the moment they ask for it and waits in
-- PAYOUT_PAYABLE until an admin either transfers it out or hands it back, so
-- the wallet balance is always exactly what they can spend or withdraw. Every
-- stage is a balanced transaction of its own; nothing is ever edited to undo.

ALTER TYPE "AccountKind" ADD VALUE IF NOT EXISTS 'PAYOUT_PAYABLE';

CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "InstructorBankAccount" (
    "instructorId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorBankAccount_pkey" PRIMARY KEY ("instructorId")
);

CREATE TABLE "PayoutRequest" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayoutRequest_status_createdAt_idx" ON "PayoutRequest"("status", "createdAt");
CREATE INDEX "PayoutRequest_instructorId_idx" ON "PayoutRequest"("instructorId");

ALTER TABLE "InstructorBankAccount" ADD CONSTRAINT "InstructorBankAccount_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One unreviewed request per instructor, decided by the database and not only
-- by the service. Prisma cannot express a partial unique index, so this is
-- written by hand and Prisma will report the schema as drifted -- the same
-- situation as the CHECK constraints in 20260908093000. Never run
-- `prisma migrate dev` against a database holding this index without reading
-- CLAUDE.md first: it will offer to reset the database.
CREATE UNIQUE INDEX "PayoutRequest_one_pending_per_instructor"
    ON "PayoutRequest"("instructorId")
    WHERE "status" = 'PENDING';

-- The floor from packages/shared/src/limits.ts, at the last layer as well.
-- Not a ทก.01 number: this extension's own rule.
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_amount_at_least_minimum"
    CHECK ("amount" >= 500);
