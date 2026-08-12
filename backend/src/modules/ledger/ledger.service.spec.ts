import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AccountKind, EntryDirection, TxType } from '@prisma/client';
import { PrismaService } from '@/infra/prisma.service';
import { LedgerService } from './ledger.service';
import { InvalidLedgerAmountException, UnbalancedLedgerException } from './ledger.errors';
import {
  accountBalance,
  createSystemAccounts,
  createUser,
  decimal,
  resetDatabase,
  type SystemAccounts,
  type TestUser,
} from '../../../test/factories';
import { assertLedgerInvariants } from '../../../test/invariants';

/** Unit-level tests of the double-entry engine, against the real database. */
describe('LedgerService', () => {
  let prisma: PrismaService;
  let ledger: LedgerService;
  let system: SystemAccounts;
  let student: TestUser;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    ledger = new LedgerService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    system = await createSystemAccounts(prisma);
    student = await createUser(prisma, { role: 'STUDENT' });
  });

  /** Moves `amount` from the bank into the student wallet. */
  async function postTopup(amount: string, key: string): Promise<string> {
    return prisma.$transaction((tx) =>
      ledger.postTransaction(tx, {
        type: TxType.TOPUP,
        idempotencyKey: key,
        referenceType: 'TopupRequest',
        referenceId: key,
        description: `เติมเงินเข้ากระเป๋า ${amount} บาท`,
        entries: [
          {
            accountId: system.externalBankId,
            direction: EntryDirection.DEBIT,
            amount: decimal(amount),
          },
          {
            accountId: student.walletAccountId,
            direction: EntryDirection.CREDIT,
            amount: decimal(amount),
          },
        ],
      }),
    );
  }

  it('posts a balanced transaction and moves both cached balances', async () => {
    await postTopup('1500.00', 'topup:a');

    expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('1500.00');
    expect((await accountBalance(prisma, system.externalBankId)).toFixed(2)).toBe('-1500.00');

    await assertLedgerInvariants(prisma, ledger);
  });

  it('rejects entries that do not balance and writes nothing', async () => {
    await expect(
      prisma.$transaction((tx) =>
        ledger.postTransaction(tx, {
          type: TxType.TOPUP,
          idempotencyKey: 'topup:unbalanced',
          referenceType: 'TopupRequest',
          referenceId: 'unbalanced',
          description: 'รายการที่ไม่สมดุล',
          entries: [
            {
              accountId: system.externalBankId,
              direction: EntryDirection.DEBIT,
              amount: decimal('100.00'),
            },
            {
              accountId: student.walletAccountId,
              direction: EntryDirection.CREDIT,
              amount: decimal('99.99'),
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(UnbalancedLedgerException);

    expect(await prisma.ledgerTransaction.count()).toBe(0);
    expect(await prisma.ledgerEntry.count()).toBe(0);
    await assertLedgerInvariants(prisma, ledger);
  });

  it('rejects a single-sided transaction', async () => {
    await expect(
      prisma.$transaction((tx) =>
        ledger.postTransaction(tx, {
          type: TxType.TOPUP,
          idempotencyKey: 'topup:one-sided',
          referenceType: 'TopupRequest',
          referenceId: 'one-sided',
          description: 'รายการด้านเดียว',
          entries: [
            {
              accountId: student.walletAccountId,
              direction: EntryDirection.CREDIT,
              amount: decimal('100.00'),
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(UnbalancedLedgerException);

    expect(await prisma.ledgerTransaction.count()).toBe(0);
  });

  it('rejects a non-positive entry amount', async () => {
    await expect(
      prisma.$transaction((tx) =>
        ledger.postTransaction(tx, {
          type: TxType.TOPUP,
          idempotencyKey: 'topup:zero',
          referenceType: 'TopupRequest',
          referenceId: 'zero',
          description: 'รายการจำนวนเงินศูนย์',
          entries: [
            {
              accountId: system.externalBankId,
              direction: EntryDirection.DEBIT,
              amount: decimal('0.00'),
            },
            {
              accountId: student.walletAccountId,
              direction: EntryDirection.CREDIT,
              amount: decimal('0.00'),
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidLedgerAmountException);

    expect(await prisma.ledgerTransaction.count()).toBe(0);
  });

  it('refuses to post the same idempotency key twice', async () => {
    await postTopup('500.00', 'topup:same-key');

    await expect(postTopup('500.00', 'topup:same-key')).rejects.toThrow();

    expect(await prisma.ledgerTransaction.count()).toBe(1);
    expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('500.00');
    await assertLedgerInvariants(prisma, ledger);
  });

  it('computeBalance recomputes from entries, not from the cache', async () => {
    await postTopup('120.50', 'topup:b');
    await postTopup('79.50', 'topup:c');

    const computed = await ledger.computeBalance(student.walletAccountId);
    expect(computed.toFixed(2)).toBe('200.00');

    // Corrupt the cache on purpose: computeBalance must ignore it.
    await prisma.account.update({
      where: { id: student.walletAccountId },
      data: { balance: decimal('999999.00') },
    });

    expect((await ledger.computeBalance(student.walletAccountId)).toFixed(2)).toBe('200.00');
  });

  it('computeBalance returns zero for an account with no entries', async () => {
    expect((await ledger.computeBalance(system.platformRevenueId)).toFixed(2)).toBe('0.00');
  });

  it('resolves wallet and system accounts', async () => {
    expect(await ledger.getWalletAccountId(student.id)).toBe(student.walletAccountId);
    expect(await ledger.getSystemAccountId(AccountKind.PLATFORM_REVENUE)).toBe(
      system.platformRevenueId,
    );
  });

  it('getWalletSummary reports the balance and the newest movements first', async () => {
    await postTopup('300.00', 'topup:d');
    // The history is ordered by createdAt, so the two must not share a tick.
    await new Promise((resolve) => setTimeout(resolve, 10));
    await postTopup('200.00', 'topup:e');

    const summary = await ledger.getWalletSummary(student.id);

    expect(summary.balance).toBe('500.00');
    expect(summary.entries).toHaveLength(2);
    expect(summary.entries[0].amount).toBe('200.00');
    expect(summary.entries[0].signedAmount).toBe('200.00');
    expect(summary.entries[0].direction).toBe(EntryDirection.CREDIT);
    expect(summary.entries[1].amount).toBe('300.00');
  });

  it('getWalletPage cuts the same statement into pages without repeating a row', async () => {
    for (const amount of ['100.00', '200.00', '300.00', '400.00', '500.00']) {
      await postTopup(amount, `topup:page-${amount}`);
    }

    const first = await ledger.getWalletPage(student.id, 1, 2);
    const second = await ledger.getWalletPage(student.id, 2, 2);
    const third = await ledger.getWalletPage(student.id, 3, 2);

    expect(first.balance).toBe('1500.00');
    expect(first.total).toBe(5);
    expect(first.totalPages).toBe(3);
    expect(first.entries).toHaveLength(2);
    expect(third.entries).toHaveLength(1);

    // Five distinct entries across three pages: nothing shown twice, nothing lost.
    const seen = [...first.entries, ...second.entries, ...third.entries].map(
      (entry) => entry.entryId,
    );
    expect(new Set(seen).size).toBe(5);
  });

  it('getWalletPage reports the balance, not the sum of the page it returns', async () => {
    await postTopup('100.00', 'topup:balance-a');
    await postTopup('900.00', 'topup:balance-b');

    const page = await ledger.getWalletPage(student.id, 2, 1);

    expect(page.entries).toHaveLength(1);
    expect(page.balance).toBe('1000.00');
  });
});
