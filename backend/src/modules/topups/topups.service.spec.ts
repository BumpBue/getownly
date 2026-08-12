import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { TopupStatus } from '@prisma/client';
import { PrismaService } from '@/infra/prisma.service';
import { LedgerService } from '@/modules/ledger/ledger.service';
import { WalletService } from '@/modules/ledger/wallet.service';
import { TopupNotPendingException } from '@/modules/ledger/ledger.errors';
import { PromptPayService } from './promptpay.service';
import { TopupsService } from './topups.service';
import {
  CannotReviewOwnTopupException,
  InvalidSlipKeyException,
  SlipNotUploadedException,
  SlipTooLargeException,
  TooManyPendingTopupsException,
  TopupAmountOutOfRangeException,
} from './topups.errors';
import {
  accountBalance,
  asAuthUser,
  createSystemAccounts,
  createUser,
  resetDatabase,
  type SystemAccounts,
  type TestUser,
} from '../../../test/factories';
import { FakeStorage } from '../../../test/fake-storage';
import { assertLedgerInvariants } from '../../../test/invariants';

const MB = 1024 * 1024;

/** Mirrors the values in .env.example, zeroed PromptPay ID included. */
const config = new ConfigService({
  PROMPTPAY_ID: '0000000000',
  PROMPTPAY_DISPLAY_NAME: 'GETOWNLY PLATFORM (สาธิต)',
  DEMO_MODE: 'true',
  TOPUP_MIN_AMOUNT: 20,
  TOPUP_MAX_AMOUNT: 50000,
  TOPUP_QUOTE_EXPIRY_MINUTES: 15,
  UPLOAD_MAX_IMAGE_MB: 5,
});

describe('TopupsService', () => {
  let prisma: PrismaService;
  let storage: FakeStorage;
  let topups: TopupsService;
  let ledger: LedgerService;

  let system: SystemAccounts;
  let admin: TestUser;
  let student: TestUser;

  /** Uploads a slip for `user` and returns its key, as the browser would. */
  function putSlip(user: TestUser, sizeBytes = 120_000): string {
    const key = `slip/${user.id}/${Math.random().toString(36).slice(2)}.jpg`;
    storage.put(key, Buffer.alloc(sizeBytes), 'image/jpeg');
    return key;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    storage = new FakeStorage();
    ledger = new LedgerService(prisma);

    topups = new TopupsService(
      config,
      prisma,
      storage.asService(),
      new PromptPayService(config),
      new WalletService(prisma, ledger),
    );

    system = await createSystemAccounts(prisma);
    admin = await createUser(prisma, { role: 'ADMIN' });
    student = await createUser(prisma, { role: 'STUDENT' });
  });

  // -------------------------------------------------------------------------
  // QR quote
  // -------------------------------------------------------------------------

  describe('quote', () => {
    it('builds an EMVCo payload carrying the exact amount and the configured ID', async () => {
      const quote = await topups.quote({ amount: '500' });

      expect(quote.amount).toBe('500.00');
      expect(quote.promptpayId).toBe('0000000000');
      // Tag 54 is the EMVCo transaction amount: "54" + length + value.
      expect(quote.payload).toContain('5406500.00');
      // A phone target is carried as 0066 + the number without its leading
      // zero, so the zeroed placeholder appears as 0066000000000.
      expect(quote.payload).toContain('0066000000000');
      // CRC is the last 4 characters, preceded by tag 6304.
      expect(quote.payload).toMatch(/6304[0-9A-F]{4}$/);
    });

    it('returns a PNG data URI that an <img> can render directly', async () => {
      const quote = await topups.quote({ amount: '1000' });

      expect(quote.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
      expect(quote.qrDataUrl.length).toBeGreaterThan(1000);
    });

    it('reports demo mode so every screen showing the QR can warn about it', async () => {
      const quote = await topups.quote({ amount: '300' });
      expect(quote.isDemoMode).toBe(true);
    });

    it('keeps satang out of the payload only when there are none', async () => {
      const quote = await topups.quote({ amount: '1234.56' });
      expect(quote.payload).toContain('54071234.56');
    });

    it('refuses an amount below the floor or above the ceiling', async () => {
      await expect(topups.quote({ amount: '19.99' })).rejects.toThrow(
        TopupAmountOutOfRangeException,
      );
      await expect(topups.quote({ amount: '50000.01' })).rejects.toThrow(
        TopupAmountOutOfRangeException,
      );
    });

    it('writes nothing: a quote is not a request', async () => {
      await topups.quote({ amount: '500' });
      expect(await prisma.topupRequest.count()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Creating a request
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('records a pending request against the caller from the token', async () => {
      const slipKey = putSlip(student);

      const request = await topups.create(asAuthUser(student), {
        amount: '500',
        slipKey,
      });

      expect(request.status).toBe(TopupStatus.PENDING);
      expect(request.amount).toBe('500.00');
      expect(request.slipUrl).toContain(slipKey);

      const row = await prisma.topupRequest.findUniqueOrThrow({ where: { id: request.id } });
      expect(row.studentId).toBe(student.id);
    });

    it('moves no money on its own', async () => {
      await topups.create(asAuthUser(student), { amount: '500', slipKey: putSlip(student) });

      expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('0.00');
      expect(await prisma.ledgerTransaction.count()).toBe(0);
    });

    it('rejects a slip key belonging to somebody else', async () => {
      const other = await createUser(prisma, { role: 'STUDENT' });
      const slipKey = putSlip(other);

      await expect(topups.create(asAuthUser(student), { amount: '500', slipKey })).rejects.toThrow(
        InvalidSlipKeyException,
      );
    });

    it('rejects a key that is not a slip at all', async () => {
      const coverKey = `cover/${student.id}/abc.jpg`;
      storage.put(coverKey, Buffer.alloc(1000), 'image/jpeg');

      await expect(
        topups.create(asAuthUser(student), { amount: '500', slipKey: coverKey }),
      ).rejects.toThrow(InvalidSlipKeyException);
    });

    it('rejects a key nothing was ever uploaded to', async () => {
      await expect(
        topups.create(asAuthUser(student), {
          amount: '500',
          slipKey: `slip/${student.id}/never-uploaded.jpg`,
        }),
      ).rejects.toThrow(SlipNotUploadedException);
    });

    it('measures the slip against what is actually in storage, not the request', async () => {
      // The browser presigned a small image and then PUT a huge one to the
      // same URL, which is exactly what presign-time checks cannot catch.
      const slipKey = putSlip(student, 6 * MB);

      await expect(topups.create(asAuthUser(student), { amount: '500', slipKey })).rejects.toThrow(
        SlipTooLargeException,
      );
    });

    it('caps how many requests one person can leave unreviewed', async () => {
      for (let index = 0; index < 5; index += 1) {
        await topups.create(asAuthUser(student), { amount: '20', slipKey: putSlip(student) });
      }

      await expect(
        topups.create(asAuthUser(student), { amount: '20', slipKey: putSlip(student) }),
      ).rejects.toThrow(TooManyPendingTopupsException);
    });

    it('frees the cap again once the queue is cleared', async () => {
      const created = [];
      for (let index = 0; index < 5; index += 1) {
        created.push(
          await topups.create(asAuthUser(student), { amount: '20', slipKey: putSlip(student) }),
        );
      }
      await topups.reject(created[0].id, asAuthUser(admin), 'สลิปไม่ชัด');

      const next = await topups.create(asAuthUser(student), {
        amount: '20',
        slipKey: putSlip(student),
      });
      expect(next.status).toBe(TopupStatus.PENDING);
    });
  });

  // -------------------------------------------------------------------------
  // Cancel
  // -------------------------------------------------------------------------

  describe('cancel', () => {
    it('withdraws a request that is still waiting for review', async () => {
      const request = await topups.create(asAuthUser(student), {
        amount: '300',
        slipKey: putSlip(student),
      });

      const cancelled = await topups.cancel(request.id, asAuthUser(student));

      expect(cancelled.status).toBe(TopupStatus.CANCELLED);
    });

    it('frees the pending-request cap, the same as a rejection does', async () => {
      const created = [];
      for (let index = 0; index < 5; index += 1) {
        created.push(
          await topups.create(asAuthUser(student), { amount: '20', slipKey: putSlip(student) }),
        );
      }
      await topups.cancel(created[0].id, asAuthUser(student));

      const next = await topups.create(asAuthUser(student), {
        amount: '20',
        slipKey: putSlip(student),
      });
      expect(next.status).toBe(TopupStatus.PENDING);
    });

    it('refuses to cancel a request that was already reviewed', async () => {
      const request = await topups.create(asAuthUser(student), {
        amount: '300',
        slipKey: putSlip(student),
      });
      await topups.reject(request.id, asAuthUser(admin), 'สลิปไม่ชัด');

      await expect(topups.cancel(request.id, asAuthUser(student))).rejects.toThrow(
        TopupNotPendingException,
      );
    });

    it('refuses to cancel somebody else`s request', async () => {
      const other = await createUser(prisma, { role: 'STUDENT' });
      const request = await topups.create(asAuthUser(other), {
        amount: '300',
        slipKey: putSlip(other),
      });

      await expect(topups.cancel(request.id, asAuthUser(student))).rejects.toThrow(
        'ไม่พบคำขอเติมเงินที่ระบุ',
      );
    });
  });

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  describe('listMine', () => {
    it('returns only the caller`s own requests, newest first', async () => {
      const other = await createUser(prisma, { role: 'STUDENT' });
      await topups.create(asAuthUser(other), { amount: '999', slipKey: putSlip(other) });

      await topups.create(asAuthUser(student), { amount: '100', slipKey: putSlip(student) });
      await topups.create(asAuthUser(student), { amount: '200', slipKey: putSlip(student) });

      const page = await topups.listMine(asAuthUser(student), {});

      expect(page.total).toBe(2);
      expect(page.items.map((item) => item.amount)).toEqual(['200.00', '100.00']);
    });

    it('pages', async () => {
      for (let index = 0; index < 3; index += 1) {
        await topups.create(asAuthUser(student), { amount: '20', slipKey: putSlip(student) });
      }

      const page = await topups.listMine(asAuthUser(student), { page: 2, limit: 2 });

      expect(page.items).toHaveLength(1);
      expect(page.totalPages).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Admin review
  // -------------------------------------------------------------------------

  describe('approve', () => {
    it('credits the wallet and leaves the ledger balanced', async () => {
      const request = await topups.create(asAuthUser(student), {
        amount: '2500',
        slipKey: putSlip(student),
      });

      const result = await topups.approve(request.id, asAuthUser(admin));

      expect(result.status).toBe(TopupStatus.APPROVED);
      expect(result.walletBalance).toBe('2500.00');
      expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('2500.00');
      expect((await accountBalance(prisma, system.externalBankId)).toFixed(2)).toBe('-2500.00');

      await assertLedgerInvariants(prisma, ledger);
    });

    it('refuses a second approval of the same request', async () => {
      const request = await topups.create(asAuthUser(student), {
        amount: '500',
        slipKey: putSlip(student),
      });
      await topups.approve(request.id, asAuthUser(admin));

      await expect(topups.approve(request.id, asAuthUser(admin))).rejects.toThrow(
        TopupNotPendingException,
      );
      expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('500.00');
      await assertLedgerInvariants(prisma, ledger);
    });

    it('refuses to let anyone review their own transfer', async () => {
      // Roles can change; the check is on identity, not on role.
      const selfServing = await createUser(prisma, { role: 'STUDENT' });
      const request = await topups.create(asAuthUser(selfServing), {
        amount: '500',
        slipKey: putSlip(selfServing),
      });

      await expect(topups.approve(request.id, asAuthUser(selfServing))).rejects.toThrow(
        CannotReviewOwnTopupException,
      );
      expect(await prisma.ledgerTransaction.count()).toBe(0);
    });
  });

  describe('reject', () => {
    it('records the reason and moves nothing', async () => {
      const request = await topups.create(asAuthUser(student), {
        amount: '500',
        slipKey: putSlip(student),
      });

      const result = await topups.reject(
        request.id,
        asAuthUser(admin),
        'ยอดในสลิปไม่ตรงกับที่แจ้ง',
      );

      expect(result.status).toBe(TopupStatus.REJECTED);
      expect(result.ledgerTransactionId).toBeNull();
      expect((await accountBalance(prisma, student.walletAccountId)).toFixed(2)).toBe('0.00');
      expect(await prisma.ledgerEntry.count()).toBe(0);

      const row = await prisma.topupRequest.findUniqueOrThrow({ where: { id: request.id } });
      expect(row.note).toBe('ยอดในสลิปไม่ตรงกับที่แจ้ง');
      expect(row.reviewedById).toBe(admin.id);
    });
  });

  describe('listForAdmin', () => {
    it('puts the waiting requests first and counts them', async () => {
      const first = await topups.create(asAuthUser(student), {
        amount: '100',
        slipKey: putSlip(student),
      });
      await topups.create(asAuthUser(student), { amount: '200', slipKey: putSlip(student) });
      await topups.approve(first.id, asAuthUser(admin));

      const page = await topups.listForAdmin({});

      expect(page.total).toBe(2);
      expect(page.pendingTotal).toBe(1);
      expect(page.items[0].status).toBe(TopupStatus.PENDING);
      expect(page.items[0].amount).toBe('200.00');
    });

    it('carries the payer and their balance, and no password hash', async () => {
      const request = await topups.create(asAuthUser(student), {
        amount: '750',
        slipKey: putSlip(student),
      });
      await topups.approve(request.id, asAuthUser(admin));

      const page = await topups.listForAdmin({ status: TopupStatus.APPROVED });
      const item = page.items[0];

      expect(item.student.id).toBe(student.id);
      expect(item.student.displayName).toBe(student.username);
      expect(item.studentWalletBalance).toBe('750.00');
      expect(item.studentApprovedCount).toBe(1);
      expect(item.reviewedBy?.id).toBe(admin.id);
      expect(JSON.stringify(item)).not.toContain('passwordHash');
    });

    it('filters by status', async () => {
      const rejected = await topups.create(asAuthUser(student), {
        amount: '100',
        slipKey: putSlip(student),
      });
      await topups.create(asAuthUser(student), { amount: '200', slipKey: putSlip(student) });
      await topups.reject(rejected.id, asAuthUser(admin), 'สลิปซ้ำ');

      const page = await topups.listForAdmin({ status: TopupStatus.REJECTED });

      expect(page.total).toBe(1);
      expect(page.items[0].note).toBe('สลิปซ้ำ');
    });
  });
});
