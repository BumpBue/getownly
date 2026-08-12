import { expect } from 'vitest';
import { EntryDirection, Prisma } from '@prisma/client';
import { PrismaService } from '@/infra/prisma.service';
import { LedgerService, ZERO } from '@/modules/ledger/ledger.service';

/**
 * The three properties that must hold after *any* sequence of money
 * operations. Called at the end of most tests rather than being a test of its
 * own, so a regression shows up wherever it was introduced.
 */
export async function assertLedgerInvariants(
  prisma: PrismaService,
  ledger: LedgerService,
): Promise<void> {
  await assertEveryTransactionBalances(prisma);
  await assertCachedBalancesMatchLedger(prisma, ledger);
  await assertSystemSumsToZero(prisma);
}

/** Invariant 1: within one transaction, total DEBIT equals total CREDIT. */
export async function assertEveryTransactionBalances(prisma: PrismaService): Promise<void> {
  const transactions = await prisma.ledgerTransaction.findMany({
    select: {
      id: true,
      entries: { select: { direction: true, amount: true } },
    },
  });

  for (const transaction of transactions) {
    let debit = ZERO;
    let credit = ZERO;
    for (const entry of transaction.entries) {
      if (entry.direction === EntryDirection.DEBIT) {
        debit = debit.plus(entry.amount);
      } else {
        credit = credit.plus(entry.amount);
      }
    }

    expect(debit.toFixed(2), `transaction ${transaction.id} is unbalanced`).toBe(credit.toFixed(2));
    expect(transaction.entries.length).toBeGreaterThanOrEqual(2);
  }
}

/** Invariant 2: the cached Account.balance equals the ledger it summarises. */
export async function assertCachedBalancesMatchLedger(
  prisma: PrismaService,
  ledger: LedgerService,
): Promise<void> {
  const accounts = await prisma.account.findMany({
    select: { id: true, kind: true, balance: true },
  });

  for (const account of accounts) {
    const computed = await ledger.computeBalance(account.id);
    expect(
      account.balance.toFixed(2),
      `cached balance of ${account.kind} account ${account.id} drifted`,
    ).toBe(computed.toFixed(2));
  }
}

/**
 * Invariant 5: every baht that exists came in through EXTERNAL_BANK, which is
 * debited for it, so all balances together always cancel out to zero.
 */
export async function assertSystemSumsToZero(prisma: PrismaService): Promise<void> {
  const accounts = await prisma.account.findMany({
    select: { balance: true },
  });

  const total = accounts.reduce((sum: Prisma.Decimal, account) => sum.plus(account.balance), ZERO);

  expect(total.toFixed(2)).toBe('0.00');
}
