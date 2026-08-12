import { Injectable } from '@nestjs/common';
import { AccountKind, EntryDirection, Prisma, TxType } from '@prisma/client';
import { PrismaService } from '@/infra/prisma.service';
import {
  InvalidLedgerAmountException,
  SystemAccountNotFoundException,
  UnbalancedLedgerException,
  WalletAccountNotFoundException,
} from './ledger.errors';
import type { WalletEntryDto, WalletPageDto, WalletSummaryDto } from './dto/ledger-response.dto';

export const ZERO = new Prisma.Decimal(0);

/** Balances are credit-normal: CREDIT increases an account, DEBIT decreases it. */
export interface LedgerEntryInput {
  accountId: string;
  direction: EntryDirection;
  /** Must be strictly positive. Direction carries the sign. */
  amount: Prisma.Decimal;
}

export interface PostTransactionInput {
  type: TxType;
  /** Deterministic, e.g. "topup:<id>". Unique across the whole ledger. */
  idempotencyKey: string;
  referenceType: string;
  referenceId: string;
  /** Thai, shown to the user in wallet history. */
  description: string;
  entries: LedgerEntryInput[];
}

/**
 * The double-entry engine. It knows about accounts and entries and nothing
 * about courses, top-ups or users.
 *
 * Every method that writes takes an explicit `Prisma.TransactionClient`,
 * because a money movement is only ever valid inside the caller's
 * `prisma.$transaction` (see CLAUDE.md, ข้อห้าม 3).
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Takes a row lock on each account before its cached balance is read or
   * written, and returns the balances as they are right now.
   *
   * Accounts are locked in id order so two concurrent transactions touching
   * an overlapping set can never deadlock: they queue instead.
   */
  async lockAccounts(
    tx: Prisma.TransactionClient,
    accountIds: string[],
  ): Promise<Map<string, Prisma.Decimal>> {
    const ids = [...new Set(accountIds)].sort();
    if (ids.length === 0) {
      return new Map();
    }

    // balance::text keeps the value exact on its way out of Postgres.
    const rows = await tx.$queryRaw<{ id: string; balance: string }[]>`
      SELECT id, balance::text AS balance
      FROM "Account"
      WHERE id IN (${Prisma.join(ids)})
      ORDER BY id
      FOR UPDATE
    `;

    if (rows.length !== ids.length) {
      const found = new Set(rows.map((row) => row.id));
      const missing = ids.find((id) => !found.has(id)) ?? 'unknown';
      throw new SystemAccountNotFoundException(missing);
    }

    return new Map(rows.map((row) => [row.id, new Prisma.Decimal(row.balance)]));
  }

  /**
   * Writes one balanced transaction and moves the cached balance of every
   * account it touches. Throws before writing anything if the entries do not
   * balance, which rolls back the caller's transaction.
   */
  async postTransaction(
    tx: Prisma.TransactionClient,
    input: PostTransactionInput,
  ): Promise<string> {
    let debitTotal = ZERO;
    let creditTotal = ZERO;

    for (const entry of input.entries) {
      if (entry.amount.lessThanOrEqualTo(ZERO)) {
        throw new InvalidLedgerAmountException(entry.amount.toFixed(2));
      }
      if (entry.direction === EntryDirection.DEBIT) {
        debitTotal = debitTotal.plus(entry.amount);
      } else {
        creditTotal = creditTotal.plus(entry.amount);
      }
    }

    if (input.entries.length < 2 || !debitTotal.equals(creditTotal)) {
      throw new UnbalancedLedgerException(debitTotal.toFixed(2), creditTotal.toFixed(2));
    }

    // Callers already lock what they read; re-locking here is free inside the
    // same transaction and guarantees no balance is ever moved unlocked.
    await this.lockAccounts(
      tx,
      input.entries.map((entry) => entry.accountId),
    );

    const transaction = await tx.ledgerTransaction.create({
      data: {
        type: input.type,
        idempotencyKey: input.idempotencyKey,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        description: input.description,
        entries: {
          create: input.entries.map((entry) => ({
            accountId: entry.accountId,
            direction: entry.direction,
            amount: entry.amount,
          })),
        },
      },
      select: { id: true },
    });

    for (const [accountId, delta] of netDeltas(input.entries)) {
      // Postgres does the addition in numeric, so the cached balance stays
      // exactly in step with the entries that were just written.
      await tx.$executeRaw`
        UPDATE "Account"
        SET balance = balance + CAST(${delta.toFixed(2)} AS numeric)
        WHERE id = ${accountId}
      `;
    }

    return transaction.id;
  }

  /**
   * Recomputes a balance from the entries themselves. The stored
   * `Account.balance` is only a cache; this is the source of truth and is what
   * the invariant tests compare against.
   */
  async computeBalance(
    accountId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Prisma.Decimal> {
    const [credit, debit] = await Promise.all([
      client.ledgerEntry.aggregate({
        _sum: { amount: true },
        where: { accountId, direction: EntryDirection.CREDIT },
      }),
      client.ledgerEntry.aggregate({
        _sum: { amount: true },
        where: { accountId, direction: EntryDirection.DEBIT },
      }),
    ]);

    return (credit._sum.amount ?? ZERO).minus(debit._sum.amount ?? ZERO);
  }

  /** Wallet balance plus the most recent movements, newest first. */
  async getWalletSummary(userId: string, limit = 20): Promise<WalletSummaryDto> {
    const account = await this.findWalletAccount(userId);
    const entries = await this.findEntries(account.id, 0, limit);

    return {
      userId,
      accountId: account.id,
      balance: account.balance.toFixed(2),
      entries,
    };
  }

  /**
   * One page of the statement behind GET /wallet.
   *
   * The balance is read from the account row rather than summed over the page,
   * because a page is a window on the ledger and the headline number is not.
   */
  async getWalletPage(userId: string, page: number, limit: number): Promise<WalletPageDto> {
    const account = await this.findWalletAccount(userId);

    const [total, entries] = await Promise.all([
      this.prisma.ledgerEntry.count({ where: { accountId: account.id } }),
      this.findEntries(account.id, (page - 1) * limit, limit),
    ]);

    return {
      balance: account.balance.toFixed(2),
      entries,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** Resolves a user's wallet account, or throws if they somehow have none. */
  async getWalletAccountId(
    userId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    const account = await client.account.findFirst({
      where: { ownerId: userId, kind: AccountKind.USER_WALLET },
      select: { id: true },
    });

    if (!account) {
      throw new WalletAccountNotFoundException(userId);
    }

    return account.id;
  }

  /**
   * Resolves one of the two platform-owned accounts (ownerId is null).
   * They are created by the seed and must always exist.
   */
  async getSystemAccountId(
    kind: AccountKind,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    const account = await client.account.findFirst({
      where: { ownerId: null, kind },
      select: { id: true },
    });

    if (!account) {
      throw new SystemAccountNotFoundException(kind);
    }

    return account.id;
  }

  /**
   * Reads entries of one account as statement lines.
   *
   * `id` breaks ties after `createdAt`, so paging never shows the same row on
   * two pages when several movements land in the same millisecond.
   */
  private async findEntries(
    accountId: string,
    skip: number,
    take: number,
  ): Promise<WalletEntryDto[]> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { accountId },
      orderBy: [{ transaction: { createdAt: 'desc' } }, { id: 'desc' }],
      skip,
      take,
      select: {
        id: true,
        direction: true,
        amount: true,
        transaction: {
          select: {
            id: true,
            type: true,
            description: true,
            createdAt: true,
          },
        },
      },
    });

    return entries.map((entry) => ({
      entryId: entry.id,
      transactionId: entry.transaction.id,
      type: entry.transaction.type,
      description: entry.transaction.description,
      direction: entry.direction,
      amount: entry.amount.toFixed(2),
      signedAmount:
        entry.direction === EntryDirection.CREDIT
          ? entry.amount.toFixed(2)
          : entry.amount.negated().toFixed(2),
      createdAt: entry.transaction.createdAt.toISOString(),
    }));
  }

  private async findWalletAccount(
    userId: string,
  ): Promise<{ id: string; balance: Prisma.Decimal }> {
    const account = await this.prisma.account.findFirst({
      where: { ownerId: userId, kind: AccountKind.USER_WALLET },
      select: { id: true, balance: true },
    });

    if (!account) {
      throw new WalletAccountNotFoundException(userId);
    }

    return account;
  }
}

/** Collapses entries into one signed delta per account (CREDIT positive). */
function netDeltas(entries: LedgerEntryInput[]): Map<string, Prisma.Decimal> {
  const deltas = new Map<string, Prisma.Decimal>();

  for (const entry of entries) {
    const signed =
      entry.direction === EntryDirection.CREDIT ? entry.amount : entry.amount.negated();
    deltas.set(entry.accountId, (deltas.get(entry.accountId) ?? ZERO).plus(signed));
  }

  return deltas;
}
