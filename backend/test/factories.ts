import { AccountKind, CourseStatus, Prisma, Role, TopupStatus } from '@prisma/client';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PrismaService } from '@/infra/prisma.service';
import type { WalletService } from '@/modules/ledger/wallet.service';

/** Test data builders. Everything they write goes to the real test database. */

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}${sequence}`;
}

export function decimal(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

/** Truncates every table so each test starts from an empty ledger. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) {
    return;
  }

  const list = tables.map((table) => `"public"."${table.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  sequence = 0;
}

export interface TestUser {
  id: string;
  walletAccountId: string;
  email: string;
  username: string;
  role: Role;
}

/** Creates a user together with the wallet account every user must have. */
export async function createUser(
  prisma: PrismaService,
  options: { role: Role; commissionRate?: string; displayName?: string } = {
    role: Role.STUDENT,
  },
): Promise<TestUser> {
  const handle = nextId(options.role.toLowerCase());
  const email = `${handle}@test.local`;

  const user = await prisma.user.create({
    data: {
      email,
      username: handle,
      // Tests never authenticate, so a literal is enough and keeps them fast.
      passwordHash: 'not-a-real-hash',
      role: options.role,
      displayName: options.displayName ?? handle,
      ...(options.commissionRate ? { commissionRate: decimal(options.commissionRate) } : {}),
    },
    select: { id: true },
  });

  const account = await prisma.account.create({
    data: { ownerId: user.id, kind: AccountKind.USER_WALLET },
    select: { id: true },
  });

  return {
    id: user.id,
    walletAccountId: account.id,
    email,
    username: handle,
    role: options.role,
  };
}

/**
 * The shape the guards put on the request, built without going through HTTP.
 * Service tests take this instead of a cookie, exactly as controllers hand it over.
 */
export function asAuthUser(user: TestUser): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  };
}

export interface SystemAccounts {
  platformRevenueId: string;
  externalBankId: string;
}

/** The two platform-owned accounts, mirroring what the seed creates. */
export async function createSystemAccounts(prisma: PrismaService): Promise<SystemAccounts> {
  const [platformRevenue, externalBank] = await Promise.all([
    prisma.account.create({
      data: { kind: AccountKind.PLATFORM_REVENUE },
      select: { id: true },
    }),
    prisma.account.create({
      data: { kind: AccountKind.EXTERNAL_BANK },
      select: { id: true },
    }),
  ]);

  return {
    platformRevenueId: platformRevenue.id,
    externalBankId: externalBank.id,
  };
}

export async function createCategory(prisma: PrismaService): Promise<string> {
  const handle = nextId('category');
  const category = await prisma.category.create({
    data: { name: `หมวดทดสอบ ${handle}`, slug: handle },
    select: { id: true },
  });
  return category.id;
}

export async function createCourse(
  prisma: PrismaService,
  options: {
    instructorId: string;
    categoryId: string;
    price: string;
    status?: CourseStatus;
    title?: string;
  },
): Promise<string> {
  const handle = nextId('course');
  const course = await prisma.course.create({
    data: {
      instructorId: options.instructorId,
      categoryId: options.categoryId,
      title: options.title ?? `คอร์สทดสอบ ${handle}`,
      description: 'คอร์สสำหรับทดสอบระบบบัญชีคู่',
      price: decimal(options.price),
      status: options.status ?? CourseStatus.PUBLISHED,
    },
    select: { id: true },
  });
  return course.id;
}

export async function createLesson(
  prisma: PrismaService,
  options: {
    courseId: string;
    orderIndex: number;
    title?: string;
    videoKey?: string | null;
    isPreview?: boolean;
    durationSec?: number;
  },
): Promise<string> {
  const lesson = await prisma.lesson.create({
    data: {
      courseId: options.courseId,
      title: options.title ?? `บทเรียนทดสอบ ${options.orderIndex}`,
      orderIndex: options.orderIndex,
      videoKey:
        options.videoKey === undefined ? `video/owner/${nextId('vid')}.mp4` : options.videoKey,
      isPreview: options.isPreview ?? false,
      durationSec: options.durationSec ?? 600,
    },
    select: { id: true },
  });
  return lesson.id;
}

export async function createMaterial(
  prisma: PrismaService,
  options: { lessonId: string; fileKey: string; fileName?: string },
): Promise<string> {
  const material = await prisma.material.create({
    data: {
      lessonId: options.lessonId,
      fileName: options.fileName ?? 'เอกสารทดสอบ.pdf',
      fileKey: options.fileKey,
      fileSize: 1024,
      mimeType: 'application/pdf',
    },
    select: { id: true },
  });
  return material.id;
}

/**
 * A quiz whose questions each have one correct choice, listed first.
 *
 * `questions` is the number of questions; every one gets four choices, so a
 * test can reason about the score without spelling out any content.
 */
export async function createQuiz(
  prisma: PrismaService,
  options: { lessonId: string; questions: number; passScore?: number; title?: string },
): Promise<string> {
  const quiz = await prisma.quiz.create({
    data: {
      lessonId: options.lessonId,
      title: options.title ?? `แบบทดสอบทดสอบ ${nextId('quiz')}`,
      passScore: options.passScore ?? 70,
    },
    select: { id: true },
  });

  for (let index = 0; index < options.questions; index += 1) {
    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: `คำถามข้อที่ ${index + 1} ของแบบทดสอบ`,
        orderIndex: index + 1,
      },
      select: { id: true },
    });

    await prisma.quizChoice.createMany({
      data: [0, 1, 2, 3].map((choiceIndex) => ({
        questionId: question.id,
        choiceText: `ตัวเลือกที่ ${choiceIndex + 1}`,
        // The first choice is always the right one, which is what lets a test
        // answer "all correct" or "all wrong" without reading the data back.
        isCorrect: choiceIndex === 0,
        orderIndex: choiceIndex + 1,
      })),
    });
  }

  return quiz.id;
}

/** Enrols a student without moving money, for tests that only care about access. */
export async function enrol(
  prisma: PrismaService,
  options: { courseId: string; studentId: string },
): Promise<void> {
  await prisma.enrollment.create({
    data: {
      courseId: options.courseId,
      studentId: options.studentId,
      pricePaid: decimal('0'),
      commissionRateSnapshot: decimal('0.30'),
    },
  });
}

export async function createTopupRequest(
  prisma: PrismaService,
  options: { studentId: string; amount: string; status?: TopupStatus },
): Promise<string> {
  const request = await prisma.topupRequest.create({
    data: {
      studentId: options.studentId,
      amount: decimal(options.amount),
      // Same shape POST /uploads/presign issues: <kind>/<userId>/<uuid>.<ext>.
      slipKey: `slip/${options.studentId}/${nextId('slip')}.jpg`,
      status: options.status ?? TopupStatus.PENDING,
    },
    select: { id: true },
  });
  return request.id;
}

/** Shortcut for "this student has N baht to spend". */
export async function fundWallet(
  prisma: PrismaService,
  wallet: WalletService,
  options: { studentId: string; adminId: string; amount: string },
): Promise<void> {
  const requestId = await createTopupRequest(prisma, {
    studentId: options.studentId,
    amount: options.amount,
  });
  await wallet.approveTopup(requestId, options.adminId);
}

export async function accountBalance(
  prisma: PrismaService,
  accountId: string,
): Promise<Prisma.Decimal> {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { balance: true },
  });
  return account.balance;
}
