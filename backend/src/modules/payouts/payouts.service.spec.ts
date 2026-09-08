import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PAYOUT_MIN_AMOUNT_BAHT } from '@getownly/shared';
import { PrismaService } from '@/infra/prisma.service';
import { LedgerService } from '@/modules/ledger/ledger.service';
import { WalletService } from '@/modules/ledger/wallet.service';
import { PayoutsService } from './payouts.service';
import {
  createCategory,
  createCourse,
  createSystemAccounts,
  createUser,
  fundWallet,
  resetDatabase,
  systemBalance,
  walletBalance,
  type SystemAccounts,
  type TestUser,
} from '../../../test/factories';
import { assertLedgerInvariants } from '../../../test/invariants';

const BANK = {
  bankName: 'ธนาคารกสิกรไทย',
  accountName: 'ครูสาธิต ใจดี',
  accountNumber: '1234567890',
};

describe('PayoutsService', () => {
  let prisma: PrismaService;
  let ledger: LedgerService;
  let wallet: WalletService;
  let payouts: PayoutsService;

  let system: SystemAccounts;
  let admin: TestUser;
  let instructor: TestUser;
  let otherInstructor: TestUser;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    ledger = new LedgerService(prisma);
    wallet = new WalletService(prisma, ledger);
    payouts = new PayoutsService(prisma, wallet);

    system = await createSystemAccounts(prisma);
    admin = await createUser(prisma, { role: 'ADMIN' });
    instructor = await createUser(prisma, { role: 'INSTRUCTOR' });
    otherInstructor = await createUser(prisma, { role: 'INSTRUCTOR' });
  });

  /** Puts baht into an instructor's wallet the way a top-up would. */
  async function fund(userId: string, amount: string): Promise<void> {
    await fundWallet(prisma, wallet, { studentId: userId, adminId: admin.id, amount });
  }

  async function saveBank(instructorId = instructor.id): Promise<void> {
    await payouts.saveBankAccount(instructorId, BANK);
  }

  // --- (ค) the floor -------------------------------------------------------

  it('(ค) refuses an amount below the minimum, and accepts the minimum itself', async () => {
    await fund(instructor.id, '5000.00');
    await saveBank();

    await expect(payouts.create(instructor.id, { amount: '499.99' })).rejects.toMatchObject({
      code: 'PAYOUT_AMOUNT_BELOW_MINIMUM',
    });

    const accepted = await payouts.create(instructor.id, {
      amount: String(PAYOUT_MIN_AMOUNT_BAHT),
    });
    expect(accepted.amount).toBe('500.00');

    await assertLedgerInvariants(prisma, ledger);
  });

  it('will not take a request before bank details are saved', async () => {
    await fund(instructor.id, '5000.00');

    await expect(payouts.create(instructor.id, { amount: '1000.00' })).rejects.toMatchObject({
      code: 'PAYOUT_BANK_ACCOUNT_REQUIRED',
    });
  });

  // --- (ก) the balance, checked after the lock ----------------------------

  it('(ก) refuses more than the wallet holds', async () => {
    await fund(instructor.id, '800.00');
    await saveBank();

    await expect(payouts.create(instructor.id, { amount: '1000.00' })).rejects.toMatchObject({
      code: 'PAYOUT_INSUFFICIENT_BALANCE',
      details: { balance: '800.00', requested: '1000.00' },
    });

    // Nothing was written on the way to being refused.
    expect(await walletBalance(prisma, instructor.id)).toBe('800.00');
    expect(await prisma.payoutRequest.count()).toBe(0);
    await assertLedgerInvariants(prisma, ledger);
  });

  // --- (ญ) the reason this design was chosen -------------------------------

  it('(ญ) takes the money out of the wallet at once, so it cannot also be spent', async () => {
    await fund(instructor.id, '2000.00');
    await saveBank();

    const categoryId = await createCategory(prisma);
    const seller = await createUser(prisma, { role: 'INSTRUCTOR' });
    const courseId = await createCourse(prisma, {
      instructorId: seller.id,
      categoryId,
      price: '1500.00',
    });

    await payouts.create(instructor.id, { amount: '1500.00' });

    expect(await walletBalance(prisma, instructor.id)).toBe('500.00');
    expect(await systemBalance(prisma, 'PAYOUT_PAYABLE')).toBe('1500.00');

    // The same 1,500 cannot be spent on a course as well.
    await expect(wallet.purchaseCourse(instructor.id, courseId)).rejects.toMatchObject({
      code: 'INSUFFICIENT_WALLET_BALANCE',
    });

    await assertLedgerInvariants(prisma, ledger);
  });

  // --- (ฎ) and back again --------------------------------------------------

  it('(ฎ) gives the money back when the request is refused, and it can be spent again', async () => {
    await fund(instructor.id, '2000.00');
    await saveBank();

    const categoryId = await createCategory(prisma);
    const seller = await createUser(prisma, { role: 'INSTRUCTOR' });
    const courseId = await createCourse(prisma, {
      instructorId: seller.id,
      categoryId,
      price: '1500.00',
    });

    const request = await payouts.create(instructor.id, { amount: '1500.00' });
    await payouts.reject(request.payoutRequestId, admin.id, 'เลขบัญชีไม่ถูกต้อง');

    expect(await walletBalance(prisma, instructor.id)).toBe('2000.00');
    expect(await systemBalance(prisma, 'PAYOUT_PAYABLE')).toBe('0.00');

    const purchase = await wallet.purchaseCourse(instructor.id, courseId);
    expect(purchase.walletBalance).toBe('500.00');

    await assertLedgerInvariants(prisma, ledger);
  });

  // --- (จ) refusal keeps every entry it ever wrote -------------------------

  it('(จ) refuses by writing a reversal, never by editing what was posted', async () => {
    await fund(instructor.id, '2000.00');
    await saveBank();

    const request = await payouts.create(instructor.id, { amount: '1500.00' });
    const afterRequest = await prisma.ledgerEntry.count();

    await payouts.reject(request.payoutRequestId, admin.id, 'เลขบัญชีไม่ถูกต้อง');

    // Two more entries, not zero and not two fewer: the original stands and a
    // second transaction undoes it (CLAUDE.md, ข้อห้าม 5).
    expect(await prisma.ledgerEntry.count()).toBe(afterRequest + 2);

    const transactions = await prisma.ledgerTransaction.findMany({
      where: { referenceId: request.payoutRequestId },
      select: { referenceType: true, idempotencyKey: true },
      orderBy: { createdAt: 'asc' },
    });
    expect(transactions.map((t) => t.referenceType)).toEqual(['PayoutRequest', 'PayoutReversal']);
    expect(transactions[1]?.idempotencyKey).toBe(`payout-reversal:${request.payoutRequestId}`);

    await assertLedgerInvariants(prisma, ledger);
  });

  // --- (ง) approval --------------------------------------------------------

  it('(ง) sends the money out of the platform on approval', async () => {
    await fund(instructor.id, '2000.00');
    await saveBank();

    const bankBefore = await systemBalance(prisma, 'EXTERNAL_BANK');
    expect(bankBefore).toBe('-2000.00');

    const request = await payouts.create(instructor.id, { amount: '1500.00' });
    const approved = await payouts.approve(request.payoutRequestId, admin.id);

    expect(approved.status).toBe('APPROVED');
    expect(approved.walletBalance).toBe('500.00');
    expect(await walletBalance(prisma, instructor.id)).toBe('500.00');
    expect(await systemBalance(prisma, 'PAYOUT_PAYABLE')).toBe('0.00');
    // EXTERNAL_BANK walks back toward the zero it started at.
    expect(await systemBalance(prisma, 'EXTERNAL_BANK')).toBe('-500.00');

    await assertLedgerInvariants(prisma, ledger);
  });

  // --- (ข) one at a time ---------------------------------------------------

  it('(ข) allows only one pending request per instructor', async () => {
    await fund(instructor.id, '5000.00');
    await saveBank();

    await payouts.create(instructor.id, { amount: '1000.00' });

    await expect(payouts.create(instructor.id, { amount: '1000.00' })).rejects.toMatchObject({
      code: 'PAYOUT_ALREADY_PENDING',
    });

    expect(await prisma.payoutRequest.count()).toBe(1);
    await assertLedgerInvariants(prisma, ledger);
  });

  it('(ข) is stopped by the database index too, not only by the service', async () => {
    await fund(instructor.id, '5000.00');
    await saveBank();
    await payouts.create(instructor.id, { amount: '1000.00' });

    // Straight past every check in the application, to prove the last line of
    // defence is real: a partial unique index on PENDING rows.
    await expect(
      prisma.payoutRequest.create({
        data: { instructorId: instructor.id, amount: '1000.00', ...BANK },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    // A finished one is not in the way of the next request.
    const pending = await prisma.payoutRequest.findFirstOrThrow({
      where: { instructorId: instructor.id, status: 'PENDING' },
    });
    await payouts.reject(pending.id, admin.id, 'ลองใหม่');
    await expect(payouts.create(instructor.id, { amount: '1000.00' })).resolves.toMatchObject({
      status: 'PENDING',
    });

    await assertLedgerInvariants(prisma, ledger);
  });

  // --- (ช) two admins, one request ----------------------------------------

  it('(ช) lets only one of two simultaneous approvals through', async () => {
    await fund(instructor.id, '5000.00');
    await saveBank();
    const request = await payouts.create(instructor.id, { amount: '1000.00' });

    const [first, second] = await Promise.allSettled([
      payouts.approve(request.payoutRequestId, admin.id),
      payouts.approve(request.payoutRequestId, admin.id),
    ]);

    const outcomes = [first.status, second.status].sort();
    expect(outcomes).toEqual(['fulfilled', 'rejected']);

    // One settlement, and the money moved once.
    const settlements = await prisma.ledgerTransaction.count({
      where: { referenceType: 'PayoutSettlement', referenceId: request.payoutRequestId },
    });
    expect(settlements).toBe(1);
    expect(await walletBalance(prisma, instructor.id)).toBe('4000.00');
    expect(await systemBalance(prisma, 'PAYOUT_PAYABLE')).toBe('0.00');

    await assertLedgerInvariants(prisma, ledger);
  });

  it('will not review a request twice in a row either', async () => {
    await fund(instructor.id, '5000.00');
    await saveBank();
    const request = await payouts.create(instructor.id, { amount: '1000.00' });
    await payouts.approve(request.payoutRequestId, admin.id);

    await expect(payouts.reject(request.payoutRequestId, admin.id, 'ขอคืน')).rejects.toMatchObject({
      code: 'PAYOUT_NOT_PENDING',
    });
  });

  // --- (ฌ) cancelling ------------------------------------------------------

  it('(ฌ) lets an instructor cancel their own request while it is pending', async () => {
    await fund(instructor.id, '5000.00');
    await saveBank();
    const request = await payouts.create(instructor.id, { amount: '1000.00' });

    const cancelled = await payouts.cancel(request.payoutRequestId, instructor.id);

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.reviewedById).toBeNull();
    expect(await walletBalance(prisma, instructor.id)).toBe('5000.00');
    await assertLedgerInvariants(prisma, ledger);
  });

  it('(ฌ) will not let them cancel one that has already been approved', async () => {
    await fund(instructor.id, '5000.00');
    await saveBank();
    const request = await payouts.create(instructor.id, { amount: '1000.00' });
    await payouts.approve(request.payoutRequestId, admin.id);

    await expect(payouts.cancel(request.payoutRequestId, instructor.id)).rejects.toMatchObject({
      code: 'PAYOUT_NOT_PENDING',
    });

    expect(await walletBalance(prisma, instructor.id)).toBe('4000.00');
    await assertLedgerInvariants(prisma, ledger);
  });

  // --- (ซ) other people's requests ----------------------------------------

  it("(ซ) will not let one instructor cancel another's request", async () => {
    await fund(instructor.id, '5000.00');
    await saveBank();
    const request = await payouts.create(instructor.id, { amount: '1000.00' });

    await expect(payouts.cancel(request.payoutRequestId, otherInstructor.id)).rejects.toMatchObject(
      { code: 'NOT_PAYOUT_OWNER' },
    );

    // Refused before anything moved.
    expect(await walletBalance(prisma, instructor.id)).toBe('4000.00');
    expect(await systemBalance(prisma, 'PAYOUT_PAYABLE')).toBe('1000.00');
    await assertLedgerInvariants(prisma, ledger);
  });

  it('(ซ) shows an instructor only their own history', async () => {
    await fund(instructor.id, '5000.00');
    await fund(otherInstructor.id, '5000.00');
    await saveBank();
    await saveBank(otherInstructor.id);
    await payouts.create(instructor.id, { amount: '1000.00' });
    await payouts.create(otherInstructor.id, { amount: '2000.00' });

    const mine = await payouts.listMine(instructor.id, {});

    expect(mine.total).toBe(1);
    expect(mine.items[0]?.amount).toBe('1000.00');
  });

  // --- masking -------------------------------------------------------------

  it('masks the account number everywhere except the owner’s own form', async () => {
    await fund(instructor.id, '5000.00');
    await saveBank();
    const request = await payouts.create(instructor.id, { amount: '1000.00' });

    const [mine, overview, forAdmin, own] = await Promise.all([
      payouts.listMine(instructor.id, {}),
      payouts.overview(instructor.id),
      payouts.readForAdmin(request.payoutRequestId),
      payouts.readBankAccount(instructor.id),
    ]);

    expect(mine.items[0]?.bankAccount.accountNumberMasked).toBe('xxxxxx7890');
    expect(overview.bankAccount?.accountNumberMasked).toBe('xxxxxx7890');
    expect(JSON.stringify(mine)).not.toContain(BANK.accountNumber);
    expect(JSON.stringify(overview)).not.toContain(BANK.accountNumber);

    // The two exceptions, both of which exist to be typed into a banking app.
    expect(forAdmin.accountNumber).toBe(BANK.accountNumber);
    expect(own?.accountNumber).toBe(BANK.accountNumber);
  });

  it('keeps the details a request was made with, even after the account changes', async () => {
    await fund(instructor.id, '5000.00');
    await saveBank();
    const request = await payouts.create(instructor.id, { amount: '1000.00' });

    await payouts.saveBankAccount(instructor.id, {
      bankName: 'ธนาคารไทยพาณิชย์',
      accountName: 'ครูสาธิต ใจดี',
      accountNumber: '9876543210',
    });

    const row = await payouts.readForAdmin(request.payoutRequestId);
    expect(row.bankName).toBe('ธนาคารกสิกรไทย');
    expect(row.accountNumber).toBe('1234567890');
  });

  // --- the admin queue -----------------------------------------------------

  it('tells the reviewer what each instructor has left in their wallet', async () => {
    await fund(instructor.id, '5000.00');
    await saveBank();
    await payouts.create(instructor.id, { amount: '1000.00' });

    const queue = await payouts.listForAdmin({});

    expect(queue.pendingTotal).toBe(1);
    expect(queue.pendingAmountTotal).toBe('1000.00');
    expect(queue.items[0]?.instructor.walletBalance).toBe('4000.00');
    expect(queue.items[0]?.instructor.id).toBe(instructor.id);
  });

  it('refuses to let an admin review a request of their own', async () => {
    await fund(admin.id, '5000.00');
    await payouts.saveBankAccount(admin.id, BANK);
    const request = await payouts.create(admin.id, { amount: '1000.00' });

    await expect(payouts.approve(request.payoutRequestId, admin.id)).rejects.toMatchObject({
      code: 'CANNOT_REVIEW_OWN_PAYOUT',
    });
  });

  // --- (ฏ) the holding account is only ever a waiting room -----------------

  it('(ฏ) holds nothing once no request is pending', async () => {
    await fund(instructor.id, '5000.00');
    await fund(otherInstructor.id, '5000.00');
    await saveBank();
    await saveBank(otherInstructor.id);

    const a = await payouts.create(instructor.id, { amount: '1000.00' });
    const b = await payouts.create(otherInstructor.id, { amount: '2000.00' });
    expect(await systemBalance(prisma, 'PAYOUT_PAYABLE')).toBe('3000.00');

    await payouts.approve(a.payoutRequestId, admin.id);
    await payouts.cancel(b.payoutRequestId, otherInstructor.id);

    expect(await systemBalance(prisma, 'PAYOUT_PAYABLE')).toBe('0.00');
    expect(system.payoutPayableId).toBeTruthy();
    await assertLedgerInvariants(prisma, ledger);
  });
});
