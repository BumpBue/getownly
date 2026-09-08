import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Role } from '@prisma/client';
import { ACCESS_TOKEN_COOKIE } from '@/common/cookies';
import { PrismaService } from '@/infra/prisma.service';
import { LedgerService } from '@/modules/ledger/ledger.service';
import { WalletService } from '@/modules/ledger/wallet.service';
import { createHarness, cookieHeader, cookiesFrom, type Harness } from './app-harness';
import { createSystemAccounts, createTopupRequest, resetDatabase } from './factories';

const BANK = {
  bankCode: '004',
  accountName: 'ครูสาธิต ใจดี',
  accountNumber: '1234567890',
};

const BANK_NAME = 'ธนาคารกสิกรไทย';

/**
 * A run of digits long enough to be a bank account.
 *
 * Used to sweep whole responses rather than named fields: a leak that mattered
 * would arrive through some field nobody thought to check, so the test looks
 * for the shape of the secret instead of for the places it is supposed to be.
 * The same idea as the source sweep in `quiz-scoring.spec.ts`.
 */
const ACCOUNT_NUMBER_PATTERN = /\d{8,}/;

/**
 * Instructor withdrawals over real HTTP.
 *
 * The service tests prove the accounting. Only a request can prove the rest:
 * that the guards hold, that one instructor cannot reach another's requests,
 * and that a full account number never leaves the two responses meant to
 * carry it.
 */
describe('Instructor payouts (e2e)', () => {
  let harness: Harness;
  let prisma: PrismaService;
  let wallet: WalletService;
  let adminId: string;

  beforeAll(async () => {
    harness = await createHarness();
    prisma = harness.prisma;
    wallet = new WalletService(prisma, new LedgerService(prisma));
  });

  afterAll(async () => {
    await harness.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    harness.resetRateLimits();
    await createSystemAccounts(prisma);
    admin = await signUp({ role: Role.ADMIN });
    adminId = admin.id;
  });

  interface Account {
    id: string;
    cookie: string;
  }

  let admin: Account;
  let sequence = 0;

  async function signUp(options: { role: Role }): Promise<Account> {
    sequence += 1;
    const handle = `pay${sequence}`;

    const response = await request(harness.server)
      .post('/api/auth/register')
      .send({
        email: `${handle}@test.local`,
        username: handle,
        password: 'Password@1234',
        displayName: `ผู้ใช้ ${handle}`,
        role: options.role === Role.ADMIN ? Role.STUDENT : options.role,
      })
      .expect(201);

    const id = response.body.user.id as string;

    if (options.role === Role.ADMIN) {
      await prisma.user.update({ where: { id }, data: { role: Role.ADMIN } });
    }

    return { id, cookie: cookieHeader(cookiesFrom(response), [ACCESS_TOKEN_COOKIE]) };
  }

  /**
   * An instructor with money in their wallet and bank details on file.
   *
   * Each one gets a different account number, so a sweep that finds BANK's
   * number in somebody else's response has found a real leak and not simply
   * two test users who happen to bank the same way.
   */
  async function readyInstructor(
    amount = '5000.00',
    accountNumber = BANK.accountNumber,
  ): Promise<Account> {
    const account = await signUp({ role: Role.INSTRUCTOR });

    const topupId = await createTopupRequest(prisma, { studentId: account.id, amount });
    await wallet.approveTopup(topupId, adminId);

    await request(harness.server)
      .put('/api/payouts/bank-account')
      .set('Cookie', account.cookie)
      .send({ ...BANK, accountNumber })
      .expect(200);

    return account;
  }

  async function submit(account: Account, amount: string): Promise<string> {
    const response = await request(harness.server)
      .post('/api/payouts')
      .set('Cookie', account.cookie)
      .send({ amount })
      .expect(201);

    return response.body.payoutRequestId as string;
  }

  // --- (ซ) who may reach what ----------------------------------------------

  it('(ซ) refuses a student every payout endpoint', async () => {
    const student = await signUp({ role: Role.STUDENT });

    await request(harness.server)
      .get('/api/payouts/overview')
      .set('Cookie', student.cookie)
      .expect(403);
    await request(harness.server)
      .get('/api/payouts/bank-account')
      .set('Cookie', student.cookie)
      .expect(403);
    await request(harness.server)
      .post('/api/payouts')
      .set('Cookie', student.cookie)
      .send({ amount: '1000.00' })
      .expect(403);
    await request(harness.server)
      .get('/api/payouts/mine')
      .set('Cookie', student.cookie)
      .expect(403);
  });

  it('(ซ) refuses an instructor the admin queue', async () => {
    const instructor = await readyInstructor();
    const id = await submit(instructor, '1000.00');

    await request(harness.server)
      .get('/api/admin/payouts')
      .set('Cookie', instructor.cookie)
      .expect(403);
    await request(harness.server)
      .get(`/api/admin/payouts/${id}`)
      .set('Cookie', instructor.cookie)
      .expect(403);
    await request(harness.server)
      .patch(`/api/admin/payouts/${id}/approve`)
      .set('Cookie', instructor.cookie)
      .expect(403);
  });

  it('(ซ) refuses anyone who is not signed in at all', async () => {
    await request(harness.server).get('/api/payouts/overview').expect(401);
    await request(harness.server).get('/api/admin/payouts').expect(401);
  });

  it("(ซ) will not let one instructor cancel another's request", async () => {
    const owner = await readyInstructor();
    const stranger = await readyInstructor('5000.00', '9999888877');
    const id = await submit(owner, '1000.00');

    const response = await request(harness.server)
      .post(`/api/payouts/${id}/cancel`)
      .set('Cookie', stranger.cookie)
      .expect(403);

    expect(response.body.code).toBe('NOT_PAYOUT_OWNER');

    const stillPending = await prisma.payoutRequest.findUniqueOrThrow({ where: { id } });
    expect(stillPending.status).toBe('PENDING');
  });

  it("(ซ) does not show one instructor another's requests", async () => {
    const owner = await readyInstructor();
    const stranger = await readyInstructor('5000.00', '9999888877');
    await submit(owner, '1000.00');

    const response = await request(harness.server)
      .get('/api/payouts/mine')
      .set('Cookie', stranger.cookie)
      .expect(200);

    expect(response.body.total).toBe(0);
    expect(response.body.items).toEqual([]);
  });

  // --- the account number ---------------------------------------------------

  it('never sends a full account number to an instructor except on their own form', async () => {
    const instructor = await readyInstructor();
    await submit(instructor, '1000.00');

    const [mine, overview] = await Promise.all([
      request(harness.server).get('/api/payouts/mine').set('Cookie', instructor.cookie).expect(200),
      request(harness.server)
        .get('/api/payouts/overview')
        .set('Cookie', instructor.cookie)
        .expect(200),
    ]);

    for (const response of [mine, overview]) {
      const body = JSON.stringify(response.body);
      expect(body).not.toContain(BANK.accountNumber);
      expect(body).not.toMatch(ACCOUNT_NUMBER_PATTERN);
      expect(body).toContain('xxxxxx7890');
    }

    // The one place it is returned, to the person it belongs to.
    const own = await request(harness.server)
      .get('/api/payouts/bank-account')
      .set('Cookie', instructor.cookie)
      .expect(200);
    expect(own.body.accountNumber).toBe(BANK.accountNumber);
  });

  it('never sends a full account number in the admin listing, only when one row is opened', async () => {
    const instructor = await readyInstructor();
    const id = await submit(instructor, '1000.00');

    const listing = await request(harness.server)
      .get('/api/admin/payouts')
      .set('Cookie', admin.cookie)
      .expect(200);

    // The queue is a list somebody scrolls past; only the row they open to
    // make the transfer carries the number.
    expect(JSON.stringify(listing.body)).not.toContain(BANK.accountNumber);
    expect(listing.body.items[0].accountNumberMasked).toBe('xxxxxx7890');

    const opened = await request(harness.server)
      .get(`/api/admin/payouts/${id}`)
      .set('Cookie', admin.cookie)
      .expect(200);
    expect(opened.body.accountNumber).toBe(BANK.accountNumber);
  });

  /**
   * A sweep, not a list of fields.
   *
   * Every response an instructor or a student can reach is checked for
   * anything shaped like an account number, so a leak added later through some
   * unrelated payload fails here rather than going unnoticed.
   */
  it('leaks no account number through any endpoint the owner does not own', async () => {
    const instructor = await readyInstructor();
    await submit(instructor, '1000.00');
    const stranger = await readyInstructor('5000.00', '9999888877');
    const student = await signUp({ role: Role.STUDENT });

    const paths = [
      { path: '/api/payouts/overview', cookie: stranger.cookie },
      { path: '/api/payouts/mine', cookie: stranger.cookie },
      { path: '/api/payouts/bank-account', cookie: stranger.cookie },
      { path: '/api/wallet', cookie: student.cookie },
      { path: '/api/courses', cookie: student.cookie },
      { path: '/api/users/me', cookie: student.cookie },
    ];

    for (const { path, cookie } of paths) {
      const response = await request(harness.server).get(path).set('Cookie', cookie);
      expect(JSON.stringify(response.body), `${path} leaked an account number`).not.toContain(
        BANK.accountNumber,
      );
    }
  });

  // --- the flow, end to end -------------------------------------------------

  it('moves the money out of the wallet when asked and out of the platform when approved', async () => {
    const instructor = await readyInstructor('5000.00');

    const before = await request(harness.server)
      .get('/api/payouts/overview')
      .set('Cookie', instructor.cookie)
      .expect(200);
    expect(before.body.walletBalance).toBe('5000.00');
    expect(before.body.withdrawableAmount).toBe('5000.00');
    expect(before.body.pendingAmount).toBe('0.00');
    expect(before.body.minimumAmount).toBe('500.00');

    const id = await submit(instructor, '1200.00');

    const waiting = await request(harness.server)
      .get('/api/payouts/overview')
      .set('Cookie', instructor.cookie)
      .expect(200);
    expect(waiting.body.walletBalance).toBe('3800.00');
    expect(waiting.body.withdrawableAmount).toBe('3800.00');
    expect(waiting.body.pendingAmount).toBe('1200.00');
    expect(waiting.body.pendingRequest.id).toBe(id);

    await request(harness.server)
      .patch(`/api/admin/payouts/${id}/approve`)
      .set('Cookie', admin.cookie)
      .expect(200);

    const after = await request(harness.server)
      .get('/api/payouts/overview')
      .set('Cookie', instructor.cookie)
      .expect(200);
    expect(after.body.walletBalance).toBe('3800.00');
    expect(after.body.pendingAmount).toBe('0.00');
    expect(after.body.pendingRequest).toBeNull();
  });

  it('refuses a rejection with no reason given', async () => {
    const instructor = await readyInstructor();
    const id = await submit(instructor, '1000.00');

    await request(harness.server)
      .patch(`/api/admin/payouts/${id}/reject`)
      .set('Cookie', admin.cookie)
      .send({ note: '   ' })
      .expect(400);

    const untouched = await prisma.payoutRequest.findUniqueOrThrow({ where: { id } });
    expect(untouched.status).toBe('PENDING');
  });

  it('refuses a bank code that is not on the list', async () => {
    const instructor = await signUp({ role: Role.INSTRUCTOR });

    for (const bankCode of ['999', '65', 'KBANK', '', 'ธนาคารกสิกรไทย']) {
      await request(harness.server)
        .put('/api/payouts/bank-account')
        .set('Cookie', instructor.cookie)
        .send({ ...BANK, bankCode })
        .expect(400);
    }

    // 065 was a real code once, and is not on this list.
    await request(harness.server)
      .put('/api/payouts/bank-account')
      .set('Cookie', instructor.cookie)
      .send({ ...BANK, bankCode: '065' })
      .expect(400);

    const saved = await prisma.instructorBankAccount.count();
    expect(saved).toBe(0);
  });

  it('names the bank from its code, on both sides of the review', async () => {
    const instructor = await readyInstructor();
    const id = await submit(instructor, '1000.00');

    const [mine, forAdmin] = await Promise.all([
      request(harness.server).get('/api/payouts/mine').set('Cookie', instructor.cookie).expect(200),
      request(harness.server)
        .get(`/api/admin/payouts/${id}`)
        .set('Cookie', admin.cookie)
        .expect(200),
    ]);

    expect(mine.body.items[0].bankAccount.bankCode).toBe('004');
    expect(mine.body.items[0].bankAccount.bankName).toBe(BANK_NAME);
    expect(forAdmin.body.bankCode).toBe('004');
    expect(forAdmin.body.bankName).toBe(BANK_NAME);
  });

  it('refuses an account number that is not a plausible one', async () => {
    const instructor = await signUp({ role: Role.INSTRUCTOR });

    await request(harness.server)
      .put('/api/payouts/bank-account')
      .set('Cookie', instructor.cookie)
      .send({ ...BANK, accountNumber: '123' })
      .expect(400);

    await request(harness.server)
      .put('/api/payouts/bank-account')
      .set('Cookie', instructor.cookie)
      .send({ ...BANK, accountNumber: 'DROP TABLE' })
      .expect(400);
  });
});
