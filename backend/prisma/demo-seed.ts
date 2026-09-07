/**
 * Demo data for getownly.
 *
 * Runs `seed.ts` first for the users, categories, courses and quizzes, then
 * adds the history a live platform would have: approved and pending top-ups,
 * purchases spread over the last five months, lessons watched, quizzes sat and
 * questions asked and answered.
 *
 * Run with:  pnpm demo:reset      (drops the database, migrates, seeds, then this)
 *            pnpm db:demo         (this alone, over an already-seeded database)
 *
 * Every money movement here goes through the same double-entry rules the API
 * uses — a balanced LedgerTransaction with an idempotency key — so the reports
 * and the trial balance agree with each other on demo day just as they do in
 * production. Nothing writes a wallet balance without writing its entries
 * (CLAUDE.md, ข้อห้าม 2).
 */
import {
  AccountKind,
  CourseStatus,
  EntryDirection,
  Prisma,
  PrismaClient,
  Role,
  TopupStatus,
  TxType,
} from '@prisma/client';

const prisma = new PrismaClient();

/** Fixed so two runs of the demo produce the same screenshots. */
let seed = 20260812;
function random(): number {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(random() * items.length)];
}

function daysAgo(days: number, hour = 10): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, Math.floor(random() * 60), 0, 0);
  return date;
}

interface Accounts {
  platformRevenueId: string;
  externalBankId: string;
  walletByUserId: Map<string, string>;
}

async function loadAccounts(): Promise<Accounts> {
  const accounts = await prisma.account.findMany({
    select: { id: true, kind: true, ownerId: true },
  });

  const platformRevenue = accounts.find((a) => a.kind === AccountKind.PLATFORM_REVENUE);
  const externalBank = accounts.find((a) => a.kind === AccountKind.EXTERNAL_BANK);

  if (!platformRevenue || !externalBank) {
    throw new Error('ไม่พบบัญชีของแพลตฟอร์ม กรุณารัน pnpm db:seed ก่อน');
  }

  return {
    platformRevenueId: platformRevenue.id,
    externalBankId: externalBank.id,
    walletByUserId: new Map(
      accounts
        .filter((a) => a.kind === AccountKind.USER_WALLET && a.ownerId)
        .map((a) => [a.ownerId as string, a.id]),
    ),
  };
}

/**
 * Writes one balanced transaction and moves the cached balances with it.
 *
 * Deliberately mirrors LedgerService rather than importing it: this script runs
 * outside Nest and has no injector, and a demo that wrote balances a different
 * way would be demonstrating something the application does not do.
 */
async function postTransaction(input: {
  type: TxType;
  idempotencyKey: string;
  referenceType: string;
  referenceId: string;
  description: string;
  createdAt: Date;
  entries: { accountId: string; direction: EntryDirection; amount: Prisma.Decimal }[];
}): Promise<string> {
  const debits = input.entries
    .filter((entry) => entry.direction === EntryDirection.DEBIT)
    .reduce((sum, entry) => sum.plus(entry.amount), new Prisma.Decimal(0));
  const credits = input.entries
    .filter((entry) => entry.direction === EntryDirection.CREDIT)
    .reduce((sum, entry) => sum.plus(entry.amount), new Prisma.Decimal(0));

  if (!debits.equals(credits)) {
    throw new Error(`รายการไม่สมดุล: debit ${debits.toFixed(2)} ≠ credit ${credits.toFixed(2)}`);
  }

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.ledgerTransaction.create({
      data: {
        type: input.type,
        idempotencyKey: input.idempotencyKey,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        description: input.description,
        createdAt: input.createdAt,
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

    for (const entry of input.entries) {
      // Balances are credit-normal: CREDIT raises an account, DEBIT lowers it.
      const delta =
        entry.direction === EntryDirection.CREDIT ? entry.amount : entry.amount.negated();
      await tx.$executeRaw`
        UPDATE "Account"
        SET balance = balance + CAST(${delta.toFixed(2)} AS numeric)
        WHERE id = ${entry.accountId}
      `;
    }

    return transaction.id;
  });
}

const TOPUP_AMOUNTS = ['500.00', '1000.00', '1500.00', '2000.00', '3000.00'];

const QUESTIONS = [
  {
    title: 'เปิดไฟล์แล้วโมเดลหายไปทั้งฉาก',
    body: 'ทำตามคลิปจนจบบทแล้วเซฟไว้ พอเปิดใหม่อีกวันโมเดลหายหมดเหลือแต่กล้อง ต้องตั้งค่าอะไรเพิ่มไหมครับ',
    answer:
      'อาการนี้เกิดจากยังไม่ได้ Set Project ก่อนเปิดไฟล์ครับ ลองไปที่ File > Set Project แล้วเลือกโฟลเดอร์โปรเจกต์เดิม จากนั้นเปิดไฟล์ใหม่อีกครั้งจะเห็นครบทุกอย่าง',
  },
  {
    title: 'เรนเดอร์แล้วภาพมืดกว่าใน Viewport มาก',
    body: 'ตั้งแสงตามคลิปทุกอย่าง ใน Viewport สว่างดี แต่พอเรนเดอร์จริงออกมามืดมาก ต้องปรับตรงไหนเพิ่มครับ',
    answer:
      'Viewport แสดงผลแบบประมาณค่า ไม่ได้คำนวณแสงจริงครับ ลองเพิ่มค่า Intensity ของ Key Light แล้วเปิด Arnold Render View ดูผลจริงระหว่างปรับ จะเห็นความต่างชัดขึ้น',
  },
  {
    title: 'Insert Edge Loop แล้วเส้นไม่ตรงกลาง',
    body: 'กด Insert Edge Loop แล้วเส้นไปเกาะขอบด้านเดียว ไม่อยู่กลางเหมือนในคลิป',
    answer: null,
  },
  {
    title: 'ไฟล์ .ma กับ .mb ต่างกันยังไง ควรใช้อันไหน',
    body: 'เห็นในคลิปใช้ .ma แต่เพื่อนบอกให้ใช้ .mb ตอนทำงานจริงควรเลือกแบบไหนครับ',
    answer:
      '.ma เป็นไฟล์ข้อความ เปิดอ่านและแก้ด้วย text editor ได้ เหมาะกับงานที่ต้องแก้ปัญหาหรือใช้ version control ส่วน .mb เป็นไฟล์ไบนารี ขนาดเล็กกว่าและเปิดเร็วกว่า เหมาะกับไฟล์ฉากใหญ่ๆ ครับ',
  },
  {
    title: 'ทำ Skin Weight แล้วแขนบิดผิดรูปตรงข้อศอก',
    body: 'พอหมุนข้อศอกแล้วผิวบริเวณข้อพับบู๋ลงไป ลองปรับ weight แล้วก็ยังไม่หาย',
    answer: null,
  },
];

async function main(): Promise<void> {
  console.log('เตรียมข้อมูลสำหรับสาธิต...');

  const [students, instructors, admin, courses] = await Promise.all([
    prisma.user.findMany({
      where: { role: Role.STUDENT },
      select: { id: true, displayName: true },
    }),
    prisma.user.findMany({
      where: { role: Role.INSTRUCTOR },
      select: { id: true, commissionRate: true },
    }),
    prisma.user.findFirst({ where: { role: Role.ADMIN }, select: { id: true } }),
    prisma.course.findMany({
      where: { status: CourseStatus.PUBLISHED },
      select: {
        id: true,
        title: true,
        price: true,
        instructorId: true,
        lessons: {
          select: { id: true, quiz: { select: { id: true } } },
          orderBy: { orderIndex: 'asc' },
        },
      },
    }),
  ]);

  if (!admin || students.length === 0 || courses.length === 0) {
    throw new Error('ไม่พบข้อมูลตั้งต้น กรุณารัน pnpm db:seed ก่อน');
  }

  const accounts = await loadAccounts();
  const commissionByInstructor = new Map(
    instructors.map((instructor) => [instructor.id, instructor.commissionRate]),
  );

  // --- top-ups -------------------------------------------------------------
  // Every student is funded far enough back that their purchases sit after it.

  console.log('เติมเงินให้ผู้เรียน...');
  let approvedTopups = 0;

  for (const [index, student] of students.entries()) {
    const amount = new Prisma.Decimal(pick(TOPUP_AMOUNTS)).plus(3000);
    const createdAt = daysAgo(160 - index, 9);

    const request = await prisma.topupRequest.create({
      data: {
        studentId: student.id,
        amount,
        slipKey: `slip/${student.id}/demo-${index + 1}.jpg`,
        status: TopupStatus.APPROVED,
        reviewedById: admin.id,
        reviewedAt: createdAt,
        createdAt,
      },
      select: { id: true },
    });

    await postTransaction({
      type: TxType.TOPUP,
      idempotencyKey: `topup:${request.id}`,
      referenceType: 'TopupRequest',
      referenceId: request.id,
      description: `เติมเงินเข้ากระเป๋า ${amount.toFixed(2)} บาท`,
      createdAt,
      entries: [
        { accountId: accounts.externalBankId, direction: EntryDirection.DEBIT, amount },
        {
          accountId: accounts.walletByUserId.get(student.id) as string,
          direction: EntryDirection.CREDIT,
          amount,
        },
      ],
    });
    approvedTopups += 1;
  }

  // Two left waiting, so the admin's review queue has something in it on the day.
  console.log('สร้างคำขอเติมเงินที่รอตรวจสอบ...');
  for (const student of students.slice(0, 2)) {
    await prisma.topupRequest.create({
      data: {
        studentId: student.id,
        amount: new Prisma.Decimal(pick(TOPUP_AMOUNTS)),
        slipKey: `slip/${student.id}/demo-pending.jpg`,
        status: TopupStatus.PENDING,
        createdAt: daysAgo(1, 20),
      },
    });
  }

  // --- purchases -----------------------------------------------------------
  // Spread across five months so the charts have a shape to them.

  console.log('สร้างประวัติการซื้อคอร์ส...');
  let purchases = 0;
  const enrollments: { id: string; studentId: string; courseId: string }[] = [];

  for (const student of students) {
    const wanted = 2 + Math.floor(random() * 3);
    const chosen = [...courses].sort(() => random() - 0.5).slice(0, wanted);

    for (const course of chosen) {
      if (course.instructorId === student.id) {
        continue;
      }

      const price = course.price;
      const commissionRate = commissionByInstructor.get(course.instructorId);
      if (!commissionRate) {
        continue;
      }

      const createdAt = daysAgo(Math.floor(random() * 150), 8 + Math.floor(random() * 10));

      const enrollment = await prisma.enrollment.create({
        data: {
          courseId: course.id,
          studentId: student.id,
          pricePaid: price,
          commissionRateSnapshot: commissionRate,
          enrolledAt: createdAt,
        },
        select: { id: true },
      });
      enrollments.push({ id: enrollment.id, studentId: student.id, courseId: course.id });

      // Free courses move no money, so they write no ledger transaction —
      // exactly what WalletService does.
      if (price.isZero()) {
        continue;
      }

      // The platform's cut is rounded first and the instructor takes the
      // remainder, so the two always add back to the price exactly
      // (CLAUDE.md, "เรื่องเงิน").
      const platformAmount = price
        .times(commissionRate)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const instructorAmount = price.minus(platformAmount);

      const entries = [
        {
          accountId: accounts.walletByUserId.get(student.id) as string,
          direction: EntryDirection.DEBIT,
          amount: price,
        },
        {
          accountId: accounts.walletByUserId.get(course.instructorId) as string,
          direction: EntryDirection.CREDIT,
          amount: instructorAmount,
        },
      ];

      if (platformAmount.greaterThan(0)) {
        entries.push({
          accountId: accounts.platformRevenueId,
          direction: EntryDirection.CREDIT,
          amount: platformAmount,
        });
      }

      await postTransaction({
        type: TxType.PURCHASE,
        idempotencyKey: `purchase:${enrollment.id}`,
        referenceType: 'Enrollment',
        referenceId: enrollment.id,
        description: `ซื้อคอร์ส ${course.title}`,
        createdAt,
        entries,
      });
      purchases += 1;
    }
  }

  // --- learning ------------------------------------------------------------

  console.log('สร้างความคืบหน้าการเรียนและผลสอบ...');
  let progressRows = 0;
  let attempts = 0;

  for (const enrollment of enrollments) {
    const course = courses.find((item) => item.id === enrollment.courseId);
    if (!course || course.lessons.length === 0) {
      continue;
    }

    // Some finish, some are partway, some only opened it once.
    const completed = Math.floor(random() * (course.lessons.length + 1));

    for (const [index, lesson] of course.lessons.entries()) {
      if (index > completed) {
        break;
      }

      await prisma.lessonProgress.create({
        data: {
          enrollmentId: enrollment.id,
          lessonId: lesson.id,
          lastPositionSec: index < completed ? 0 : Math.floor(random() * 400),
          completedAt: index < completed ? daysAgo(Math.floor(random() * 60)) : null,
        },
      });
      progressRows += 1;

      if (index < completed && lesson.quiz) {
        const quiz = await prisma.quiz.findUniqueOrThrow({
          where: { id: lesson.quiz.id },
          select: { passScore: true, _count: { select: { questions: true } } },
        });
        const questionCount = quiz._count.questions;
        if (questionCount === 0) {
          continue;
        }

        const correct = Math.round(questionCount * (0.5 + random() * 0.5));
        const score = Math.round((correct / questionCount) * 100);

        // The verdict and the bar it was judged against, written together the
        // way QuizzesService.submit does. The bar comes from the quiz rather
        // than a literal, so a seeded pass is a pass by that quiz's own rule.
        await prisma.quizAttempt.create({
          data: {
            quizId: lesson.quiz.id,
            studentId: enrollment.studentId,
            score,
            passed: score >= quiz.passScore,
            passScoreSnapshot: quiz.passScore,
            attemptedAt: daysAgo(Math.floor(random() * 60)),
          },
        });
        attempts += 1;
      }
    }
  }

  // --- questions -----------------------------------------------------------

  console.log('สร้างกระทู้ถาม-ตอบ...');
  let threads = 0;
  let answered = 0;

  for (const [index, question] of QUESTIONS.entries()) {
    const enrollment = enrollments[(index * 3) % enrollments.length];
    if (!enrollment) {
      continue;
    }

    const course = courses.find((item) => item.id === enrollment.courseId);
    if (!course) {
      continue;
    }

    const createdAt = daysAgo(20 - index * 3, 14);
    const thread = await prisma.qnaThread.create({
      data: {
        courseId: course.id,
        lessonId: course.lessons[0]?.id ?? null,
        studentId: enrollment.studentId,
        title: question.title,
        body: question.body,
        isResolved: question.answer !== null && index % 2 === 0,
        createdAt,
      },
      select: { id: true },
    });
    threads += 1;

    if (question.answer) {
      await prisma.qnaReply.create({
        data: {
          threadId: thread.id,
          userId: course.instructorId,
          body: question.answer,
          createdAt: new Date(createdAt.getTime() + 4 * 60 * 60 * 1000),
        },
      });
      answered += 1;
    }
  }

  // --- proof ---------------------------------------------------------------
  // The same invariant the test suite asserts after every money test: if this
  // fails, the demo data is not safe to show anybody.

  const [{ debit, credit }] = await prisma.$queryRaw<{ debit: string; credit: string }[]>`
    SELECT
      COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN amount END), 0)::text AS debit,
      COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount END), 0)::text AS credit
    FROM "LedgerEntry"
  `;

  if (debit !== credit) {
    throw new Error(`งบทดลองไม่สมดุล: debit ${debit} ≠ credit ${credit}`);
  }

  const [platformRevenue, pendingTopups] = await Promise.all([
    prisma.account.findFirst({
      where: { kind: AccountKind.PLATFORM_REVENUE },
      select: { balance: true },
    }),
    prisma.topupRequest.count({ where: { status: TopupStatus.PENDING } }),
  ]);

  console.log('');
  console.log('เสร็จสิ้น สรุปข้อมูลสาธิตที่เพิ่มเข้าไป');
  console.log(`  เติมเงินที่อนุมัติแล้ว   ${approvedTopups} รายการ`);
  console.log(`  เติมเงินที่รอตรวจสอบ    ${pendingTopups} รายการ`);
  console.log(`  การซื้อคอร์ส            ${purchases} รายการ`);
  console.log(`  ความคืบหน้าการเรียน      ${progressRows} รายการ`);
  console.log(`  ผลการทำแบบทดสอบ         ${attempts} รายการ`);
  console.log(`  กระทู้ถาม-ตอบ            ${threads} กระทู้ (ผู้สอนตอบแล้ว ${answered})`);
  console.log(`  รายได้สะสมของแพลตฟอร์ม   ${platformRevenue?.balance.toFixed(2) ?? '0.00'} บาท`);
  console.log('');
  console.log(`  งบทดลองสมดุล: debit ${debit} = credit ${credit}`);
}

main()
  .catch((error: unknown) => {
    console.error('demo seed ล้มเหลว:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
