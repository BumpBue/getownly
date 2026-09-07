import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Role } from '@prisma/client';
import { ACCESS_TOKEN_COOKIE } from '@/common/cookies';
import { PrismaService } from '@/infra/prisma.service';
import { LedgerService } from '@/modules/ledger/ledger.service';
import { WalletService } from '@/modules/ledger/wallet.service';
import { createHarness, cookieHeader, cookiesFrom, type Harness } from './app-harness';
import {
  createCategory,
  createCourse,
  createSystemAccounts,
  createTopupRequest,
  resetDatabase,
} from './factories';

const TRANSACTIONS = '/api/instructor/reports/transactions';

/**
 * ทก.01 A10, over real HTTP.
 *
 * The service tests already prove the arithmetic. What only a request can
 * prove is that the guards, the token and the query scope line up: an
 * instructor who asks this endpoint for someone else's sales gets their own
 * empty table, or a refusal — never the other instructor's rows.
 */
describe('Instructor earnings (e2e)', () => {
  let harness: Harness;
  let prisma: PrismaService;
  let wallet: WalletService;

  let categoryId: string;
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
    categoryId = await createCategory(prisma);

    // An admin has to exist to approve the top-ups that fund the buyers.
    const admin = await signUp({ role: Role.ADMIN });
    adminId = admin.id;
  });

  interface Account {
    id: string;
    cookie: string;
  }

  let sequence = 0;

  /**
   * Registers through the API so the password is hashed the way login expects,
   * then keeps the access cookie the response set.
   *
   * ADMIN is not a self-service role, so an admin is promoted afterwards — the
   * account itself still comes from the real registration path.
   */
  async function signUp(options: { role: Role }): Promise<Account> {
    sequence += 1;
    const handle = `earn${sequence}`;

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

    return {
      id,
      cookie: cookieHeader(cookiesFrom(response), [ACCESS_TOKEN_COOKIE]),
    };
  }

  /** One completed sale of a new course belonging to `instructorId`. */
  async function sell(options: {
    instructorId: string;
    price: string;
    title: string;
  }): Promise<{ courseId: string }> {
    const courseId = await createCourse(prisma, {
      instructorId: options.instructorId,
      categoryId,
      price: options.price,
      title: options.title,
    });

    const buyer = await signUp({ role: Role.STUDENT });
    const topupId = await createTopupRequest(prisma, {
      studentId: buyer.id,
      amount: '10000.00',
    });
    await wallet.approveTopup(topupId, adminId);
    await wallet.purchaseCourse(buyer.id, courseId);

    return { courseId };
  }

  function get(cookie: string, query = ''): request.Test {
    return request(harness.server).get(`${TRANSACTIONS}${query}`).set('Cookie', cookie);
  }

  it('returns only the caller own sales, with the four figures per row', async () => {
    const mine = await signUp({ role: Role.INSTRUCTOR });
    const theirs = await signUp({ role: Role.INSTRUCTOR });

    await sell({ instructorId: mine.id, price: '1000.00', title: 'ของฉัน' });
    await sell({ instructorId: theirs.id, price: '2000.00', title: 'ของเขา' });

    const response = await get(mine.cookie).expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      courseTitle: 'ของฉัน',
      grossAmount: '1000.00',
      commissionRateSnapshot: '0.3000',
      platformFeeAmount: '300.00',
      netAmount: '700.00',
    });

    const titles = response.body.items.map((item: { courseTitle: string }) => item.courseTitle);
    expect(titles).not.toContain('ของเขา');
  });

  it('refuses a course filter naming another instructor course', async () => {
    const mine = await signUp({ role: Role.INSTRUCTOR });
    const theirs = await signUp({ role: Role.INSTRUCTOR });

    const theirSale = await sell({ instructorId: theirs.id, price: '2000.00', title: 'ของเขา' });

    // NOT_COURSE_OWNER rather than an empty list: an empty table would read
    // as "this course has never sold", which is somebody else's information.
    const response = await get(mine.cookie, `?courseId=${theirSale.courseId}`).expect(403);
    expect(response.body.code).toBe('NOT_COURSE_OWNER');
  });

  it('refuses a caller with no session at all', async () => {
    await request(harness.server).get(TRANSACTIONS).expect(401);
  });

  it('refuses a student, who has no sales to report on', async () => {
    const student = await signUp({ role: Role.STUDENT });

    await get(student.cookie).expect(403);
  });

  it('sends an empty page rather than an error before the first sale', async () => {
    const instructor = await signUp({ role: Role.INSTRUCTOR });

    const response = await get(instructor.cookie).expect(200);

    expect(response.body).toMatchObject({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totals: { grossAmount: '0.00', platformFeeAmount: '0.00', netAmount: '0.00' },
    });
  });

  it('rejects a malformed date instead of quietly ignoring it', async () => {
    const instructor = await signUp({ role: Role.INSTRUCTOR });

    await get(instructor.cookie, '?from=2026-9-1').expect(400);
  });
});
