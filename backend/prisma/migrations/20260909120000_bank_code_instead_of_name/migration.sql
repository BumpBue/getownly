-- Banks are chosen from a list and stored by their Bank of Thailand code,
-- instead of being typed in free text.
--
-- Free text meant an admin about to make a transfer could be looking at
-- "กสิกร", "KBANK" or "ธ.กสิกรไทย" for the same bank. A code is one value per
-- bank, and it survives the renames a name does not: ทหารไทย and ธนชาต became
-- ttb, and 011 stayed 011.
--
-- No data to carry over: this ships in the same release as payouts themselves,
-- and both tables are empty in every database (verified before writing this).
-- Should that ever stop being true, the ALTERs below would need a mapping step
-- first, because there is no way to turn arbitrary typed text into a code.

ALTER TABLE "InstructorBankAccount" DROP COLUMN "bankName";
ALTER TABLE "InstructorBankAccount" ADD COLUMN "bankCode" TEXT NOT NULL;

-- PayoutRequest keeps "bankName" as well: the code renders a bank that is
-- still in the list, and the name is the record of what it was called on the
-- day the request was made. History, not policy.
ALTER TABLE "PayoutRequest" ADD COLUMN "bankCode" TEXT NOT NULL;
