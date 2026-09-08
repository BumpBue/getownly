/**
 * The minimum a brand-new database needs before anybody can use the site:
 * one admin, and the two platform-level ledger accounts.
 *
 * Everything else — categories, courses, students, purchases — is meant to be
 * created through the web app. This exists because two things cannot be:
 * ADMIN is not a self-service role (ทก.01 ข้อ C says one admin account, and
 * POST /auth/register only accepts STUDENT or INSTRUCTOR), and the
 * PLATFORM_REVENUE / EXTERNAL_BANK accounts have no owner to create them.
 *
 * Unlike seed.ts this **adds** and never wipes, so running it against a
 * populated database is harmless — it stops if an admin already exists.
 *
 * Run with:  pnpm --filter backend db:bootstrap
 */
import { AccountKind, PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_COST = Number(process.env.BCRYPT_COST ?? 12);
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@getownly.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@1234';

async function main(): Promise<void> {
  // The database this is about to write to, named out loud before it writes.
  // CLAUDE.md ข้อ 6.1: no write command stays quiet about its target.
  const target = (process.env.DATABASE_URL ?? '').replace(/^.*\//, '').replace(/\?.*$/, '');
  console.log(`ฐานข้อมูลปลายทาง: ${target || '(ไม่ทราบ)'}`);

  const existing = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    select: { email: true },
  });

  if (existing) {
    console.log(`มีผู้ดูแลระบบอยู่แล้ว (${existing.email}) — ไม่ต้องทำอะไรเพิ่ม`);
    await prisma.$disconnect();
    return;
  }

  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      username: 'admin',
      passwordHash: await hash(ADMIN_PASSWORD, BCRYPT_COST),
      role: Role.ADMIN,
      displayName: 'ผู้ดูแลระบบ getownly',
    },
    select: { id: true },
  });

  await prisma.account.create({
    data: { ownerId: admin.id, kind: AccountKind.USER_WALLET },
  });

  // Exactly one of each, and neither has an owner.
  for (const kind of [AccountKind.PLATFORM_REVENUE, AccountKind.EXTERNAL_BANK]) {
    const already = await prisma.account.findFirst({ where: { kind }, select: { id: true } });
    if (!already) {
      await prisma.account.create({ data: { kind } });
    }
  }

  console.log('');
  console.log('เตรียมระบบเรียบร้อย');
  console.log(`  ADMIN  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log('  บัญชี PLATFORM_REVENUE และ EXTERNAL_BANK พร้อมใช้งาน');
  console.log('');
  console.log('ที่เหลือสร้างผ่านหน้าเว็บได้ทั้งหมด: หมวดหมู่ ผู้สอน ผู้เรียน คอร์ส');

  await prisma.$disconnect();
}

void main();
