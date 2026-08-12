import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hash } from 'bcrypt';
import { PrismaService } from '@/infra/prisma.service';
import { TokenService } from '@/modules/auth/token.service';
import { UsersService } from './users.service';
import { asAuthUser, createUser, resetDatabase, type TestUser } from '../../../test/factories';

/** Cost 4 rather than the configured 12: these tests hash, they do not defend. */
const TEST_BCRYPT_COST = 4;

describe('UsersService', () => {
  let prisma: PrismaService;
  let users: UsersService;

  let admin: TestUser;
  let instructor: TestUser;
  let student: TestUser;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);

    const config = new ConfigService({ BCRYPT_COST: String(TEST_BCRYPT_COST) });
    // Only `revokeAllForUser` is exercised here, and that never signs anything.
    const tokens = new TokenService(
      prisma,
      { signAsync: () => Promise.resolve('') } as never,
      config,
    );
    users = new UsersService(prisma, tokens, config);

    admin = await createUser(prisma, { role: 'ADMIN' });
    instructor = await createUser(prisma, { role: 'INSTRUCTOR', displayName: 'ครูทดสอบ' });
    student = await createUser(prisma, { role: 'STUDENT', displayName: 'ผู้เรียนทดสอบ' });
  });

  // --- the person's own profile --------------------------------------------

  it('updates only the fields the profile form owns', async () => {
    const profile = await users.updateProfile(student.id, {
      displayName: 'ชื่อใหม่',
      bio: 'แนะนำตัวสั้นๆ',
    });

    expect(profile.displayName).toBe('ชื่อใหม่');
    expect(profile.bio).toBe('แนะนำตัวสั้นๆ');
    // Role and status are not fields on the DTO, so nothing can reach them.
    expect(profile.role).toBe('STUDENT');
    expect(profile.status).toBe('ACTIVE');
  });

  it('stores an emptied field as null, not as an empty string', async () => {
    await users.updateProfile(student.id, { bio: 'มีข้อความ' });
    const cleared = await users.updateProfile(student.id, { bio: '   ' });

    expect(cleared.bio).toBeNull();
  });

  it('never returns a password hash from the profile endpoint', async () => {
    const profile = await users.updateProfile(student.id, { displayName: 'ใครสักคน' });

    expect(JSON.stringify(profile)).not.toContain('passwordHash');
  });

  it('refuses a password change that does not know the current password', async () => {
    await prisma.user.update({
      where: { id: student.id },
      data: { passwordHash: await hash('OldPassword1', TEST_BCRYPT_COST) },
    });

    await expect(
      users.changePassword(student.id, {
        currentPassword: 'NotThePassword1',
        newPassword: 'NewPassword1',
      }),
    ).rejects.toMatchObject({ code: 'WRONG_CURRENT_PASSWORD' });
  });

  it('signs every session out when the password changes', async () => {
    await prisma.user.update({
      where: { id: student.id },
      data: { passwordHash: await hash('OldPassword1', TEST_BCRYPT_COST) },
    });
    await prisma.refreshToken.create({
      data: {
        userId: student.id,
        tokenHash: 'a-session-that-was-open',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await users.changePassword(student.id, {
      currentPassword: 'OldPassword1',
      newPassword: 'NewPassword1',
    });

    const live = await prisma.refreshToken.count({
      where: { userId: student.id, revokedAt: null },
    });
    // Changing a password is what you do when a session might not be yours.
    expect(live).toBe(0);
  });

  it('dates every access token already out there', async () => {
    await prisma.user.update({
      where: { id: student.id },
      data: { passwordHash: await hash('OldPassword1', TEST_BCRYPT_COST) },
    });

    const before = new Date();
    await users.changePassword(student.id, {
      currentPassword: 'OldPassword1',
      newPassword: 'NewPassword1',
    });

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: student.id },
      select: { passwordChangedAt: true },
    });

    // JwtAuthGuard refuses any access token issued before this moment.
    // Revoking refresh tokens alone would leave the caller's own token
    // working for the rest of its 15 minutes.
    expect(stored.passwordChangedAt).not.toBeNull();
    expect(stored.passwordChangedAt?.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
  });

  // --- the admin's view -----------------------------------------------------

  it('filters by role and by status, and counts the whole platform regardless', async () => {
    await users.setStatus(student.id, asAuthUser(admin), 'SUSPENDED');

    const instructors = await users.listForAdmin({ role: 'INSTRUCTOR' });
    expect(instructors.total).toBe(1);
    expect(instructors.items[0]?.displayName).toBe('ครูทดสอบ');

    const suspended = await users.listForAdmin({ status: 'SUSPENDED' });
    expect(suspended.total).toBe(1);

    // The tiles above the table are not affected by the filter below it.
    expect(instructors.counts).toMatchObject({
      total: 3,
      students: 1,
      instructors: 1,
      admins: 1,
      suspended: 1,
    });
  });

  it('searches by email, which is what an admin arrives holding', async () => {
    const found = await users.listForAdmin({ search: student.email });

    expect(found.total).toBe(1);
    expect(found.items[0]?.id).toBe(student.id);
  });

  it('never puts a password hash in the admin listing', async () => {
    const page = await users.listForAdmin({});

    expect(JSON.stringify(page)).not.toContain('passwordHash');
  });

  it('suspends an account and brings it back', async () => {
    const suspended = await users.setStatus(student.id, asAuthUser(admin), 'SUSPENDED');
    expect(suspended.status).toBe('SUSPENDED');

    const restored = await users.setStatus(student.id, asAuthUser(admin), 'ACTIVE');
    expect(restored.status).toBe('ACTIVE');
  });

  it('refuses to let an admin suspend themselves', async () => {
    // JwtAuthGuard re-reads the user every request, so this would lock the
    // back office behind an account that can no longer sign in.
    await expect(users.setStatus(admin.id, asAuthUser(admin), 'SUSPENDED')).rejects.toMatchObject({
      code: 'CANNOT_SUSPEND_SELF',
    });
  });

  it('answers 404 for a user that does not exist', async () => {
    await expect(
      users.setStatus('does-not-exist', asAuthUser(admin), 'SUSPENDED'),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });

  // --- commission -----------------------------------------------------------

  it('sets an instructor commission as an exact decimal', async () => {
    const updated = await users.setCommissionRate(instructor.id, '0.25');

    expect(updated.commissionRate).toBe('0.2500');

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: instructor.id },
      select: { commissionRate: true },
    });
    // Stored as a Decimal, never having passed through a JS number.
    expect(stored.commissionRate.toFixed(4)).toBe('0.2500');
  });

  it('refuses a commission above half of every sale', async () => {
    await expect(users.setCommissionRate(instructor.id, '0.75')).rejects.toMatchObject({
      code: 'COMMISSION_NOT_APPLICABLE',
    });
  });

  it('refuses a commission on somebody who does not sell anything', async () => {
    await expect(users.setCommissionRate(student.id, '0.25')).rejects.toMatchObject({
      code: 'COMMISSION_NOT_APPLICABLE',
    });
  });
});
