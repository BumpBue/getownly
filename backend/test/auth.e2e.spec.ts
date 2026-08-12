import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { AccountKind, Role, UserStatus } from '@prisma/client';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/common/cookies';
import { hashToken } from '@/modules/auth/token.service';
import { createHarness, cookieHeader, cookiesFrom, type Harness } from './app-harness';
import { resetDatabase } from './factories';
import {
  clearMailbox,
  extractResetToken,
  listMessages,
  messageBody,
  waitForMessage,
} from './mailhog';

const REGISTER = '/api/auth/register';
const LOGIN = '/api/auth/login';
const REFRESH = '/api/auth/refresh';
const LOGOUT = '/api/auth/logout';
const ME = '/api/auth/me';
const FORGOT = '/api/auth/forgot-password';
const RESET = '/api/auth/reset-password';

const STUDENT = {
  email: 'teerapat@example.com',
  username: 'teerapat.k',
  password: 'Password@1234',
  displayName: 'ธีรพัฒน์ กิตติวงศ์',
  role: Role.STUDENT,
};

describe('Auth (e2e)', () => {
  let harness: Harness;

  beforeAll(async () => {
    harness = await createHarness();
  });

  afterAll(async () => {
    await harness.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(harness.prisma);
    harness.resetRateLimits();
  });

  // Not async on purpose: returning the supertest Test keeps `.expect()` chainable.
  function registerStudent(overrides: Partial<typeof STUDENT> = {}): request.Test {
    return request(harness.server)
      .post(REGISTER)
      .send({ ...STUDENT, ...overrides });
  }

  function loginAs(identifier: string, password: string): request.Test {
    return request(harness.server).post(LOGIN).send({ identifier, password });
  }

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  describe('POST /auth/register', () => {
    it('creates the user, the wallet account and both cookies', async () => {
      const response = await registerStudent().expect(201);

      expect(response.body.user).toMatchObject({
        email: STUDENT.email,
        username: STUDENT.username,
        displayName: STUDENT.displayName,
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
      });

      // Nothing secret may ride along in the body.
      const serialised = JSON.stringify(response.body);
      expect(serialised).not.toContain('passwordHash');
      expect(serialised).not.toContain('$2b$');
      expect(response.body.user.token).toBeUndefined();

      const jar = cookiesFrom(response);
      expect(jar[ACCESS_TOKEN_COOKIE]).toBeTruthy();
      expect(jar[REFRESH_TOKEN_COOKIE]).toBeTruthy();

      const rawCookies = response.headers['set-cookie'] as unknown as string[];
      expect(rawCookies.every((cookie) => cookie.includes('HttpOnly'))).toBe(true);
      expect(rawCookies.every((cookie) => /SameSite=Lax/i.test(cookie))).toBe(true);
      // No Domain attribute: the cookie stays on the exact host that set it.
      expect(rawCookies.some((cookie) => /Domain=/i.test(cookie))).toBe(false);

      // Every user needs the wallet account the ledger assumes exists.
      const account = await harness.prisma.account.findFirst({
        where: { ownerId: response.body.user.id, kind: AccountKind.USER_WALLET },
      });
      expect(account).not.toBeNull();
      expect(account?.balance.toFixed(2)).toBe('0.00');
    });

    it('stores the password as a bcrypt hash, never in the clear', async () => {
      await registerStudent().expect(201);

      const user = await harness.prisma.user.findUniqueOrThrow({
        where: { email: STUDENT.email },
      });
      expect(user.passwordHash).not.toBe(STUDENT.password);
      expect(user.passwordHash.startsWith('$2b$12$')).toBe(true);
    });

    it('refuses to create an ADMIN account', async () => {
      const response = await registerStudent({
        role: Role.ADMIN as never,
      }).expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
      expect(response.body.errors.role[0]).toContain('ผู้เรียนหรือผู้สอน');
      expect(await harness.prisma.user.count()).toBe(0);
    });

    it('rejects a duplicate email and a duplicate username separately', async () => {
      await registerStudent().expect(201);

      const sameEmail = await registerStudent({ username: 'someone.else' }).expect(409);
      expect(sameEmail.body.code).toBe('EMAIL_ALREADY_USED');
      expect(sameEmail.body.message).toBe('อีเมลนี้ถูกใช้สมัครไปแล้ว');

      const sameUsername = await registerStudent({ email: 'other@example.com' }).expect(409);
      expect(sameUsername.body.code).toBe('USERNAME_ALREADY_USED');
    });

    it('returns per-field Thai messages in the standard error shape', async () => {
      const response = await request(harness.server)
        .post(REGISTER)
        .send({
          email: 'ไม่ใช่อีเมล',
          username: 'AB',
          password: 'sh0rt',
          displayName: 'ก',
          role: 'STUDENT',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        path: REGISTER,
      });
      expect(typeof response.body.timestamp).toBe('string');
      expect(Object.keys(response.body.errors).sort()).toEqual([
        'displayName',
        'email',
        'password',
        'username',
      ]);
      expect(response.body.errors.email[0]).toBe('รูปแบบอีเมลไม่ถูกต้อง');
    });

    it('rejects fields that are not on the DTO', async () => {
      const response = await request(harness.server)
        .post(REGISTER)
        .send({ ...STUDENT, commissionRate: '0.0001' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
      expect(await harness.prisma.user.count()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await registerStudent().expect(201);
    });

    it('accepts either the email or the username', async () => {
      const byEmail = await loginAs(STUDENT.email, STUDENT.password).expect(200);
      expect(byEmail.body.user.username).toBe(STUDENT.username);
      expect(cookiesFrom(byEmail)[ACCESS_TOKEN_COOKIE]).toBeTruthy();

      const byUsername = await loginAs(STUDENT.username, STUDENT.password).expect(200);
      expect(byUsername.body.user.email).toBe(STUDENT.email);
    });

    it('answers a wrong password and an unknown account identically', async () => {
      const wrongPassword = await loginAs(STUDENT.email, 'Wrong@9999').expect(401);
      const unknownUser = await loginAs('nobody@example.com', 'Wrong@9999').expect(401);

      expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
      expect(unknownUser.body.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPassword.body.message).toBe(unknownUser.body.message);
    });

    it('refuses a suspended account with 403 and Thai copy', async () => {
      await harness.prisma.user.update({
        where: { email: STUDENT.email },
        data: { status: UserStatus.SUSPENDED },
      });

      const response = await loginAs(STUDENT.email, STUDENT.password).expect(403);
      expect(response.body.code).toBe('ACCOUNT_SUSPENDED');
      expect(response.body.message).toBe('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
    });
  });

  // -------------------------------------------------------------------------
  // Session
  // -------------------------------------------------------------------------

  describe('GET /auth/me', () => {
    it('requires a signed-in caller', async () => {
      const response = await request(harness.server).get(ME).expect(401);
      expect(response.body.code).toBe('UNAUTHENTICATED');
      expect(response.body.message).toBe('กรุณาเข้าสู่ระบบก่อนใช้งาน');
    });

    it('returns the caller profile without any secret field', async () => {
      const registered = await registerStudent().expect(201);
      const jar = cookiesFrom(registered);

      const response = await request(harness.server)
        .get(ME)
        .set('Cookie', cookieHeader(jar, [ACCESS_TOKEN_COOKIE]))
        .expect(200);

      expect(response.body.user.email).toBe(STUDENT.email);
      expect(response.body.user.passwordHash).toBeUndefined();
      expect(response.body.user.commissionRate).toBe('0.3000');
    });

    it('rejects a token that was tampered with', async () => {
      const registered = await registerStudent().expect(201);
      const jar = cookiesFrom(registered);
      const forged = `${jar[ACCESS_TOKEN_COOKIE].slice(0, -3)}xyz`;

      await request(harness.server)
        .get(ME)
        .set('Cookie', `${ACCESS_TOKEN_COOKIE}=${forged}`)
        .expect(401);
    });

    it('locks out a suspended user immediately, without waiting for the token to expire', async () => {
      const registered = await registerStudent().expect(201);
      const jar = cookiesFrom(registered);
      const authCookie = cookieHeader(jar, [ACCESS_TOKEN_COOKIE]);

      await request(harness.server).get(ME).set('Cookie', authCookie).expect(200);

      await harness.prisma.user.update({
        where: { email: STUDENT.email },
        data: { status: UserStatus.SUSPENDED },
      });

      // Same still-valid access token, now refused.
      const response = await request(harness.server).get(ME).set('Cookie', authCookie).expect(403);
      expect(response.body.code).toBe('ACCOUNT_SUSPENDED');
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the pair and stores only a hash of the new token', async () => {
      const registered = await registerStudent().expect(201);
      const firstJar = cookiesFrom(registered);

      const refreshed = await request(harness.server)
        .post(REFRESH)
        .set('Cookie', cookieHeader(firstJar, [REFRESH_TOKEN_COOKIE]))
        .expect(200);

      const secondJar = cookiesFrom(refreshed);
      expect(secondJar[REFRESH_TOKEN_COOKIE]).toBeTruthy();
      expect(secondJar[REFRESH_TOKEN_COOKIE]).not.toBe(firstJar[REFRESH_TOKEN_COOKIE]);

      // The new access token works.
      await request(harness.server)
        .get(ME)
        .set('Cookie', cookieHeader(secondJar, [ACCESS_TOKEN_COOKIE]))
        .expect(200);

      // The raw token is nowhere in the database; only its digest is.
      const stored = await harness.prisma.refreshToken.findMany({
        select: { tokenHash: true, revokedAt: true },
      });
      expect(stored).toHaveLength(2);
      expect(stored.map((row) => row.tokenHash)).not.toContain(secondJar[REFRESH_TOKEN_COOKIE]);
      expect(stored.map((row) => row.tokenHash)).toContain(
        hashToken(secondJar[REFRESH_TOKEN_COOKIE]),
      );
    });

    it('rejects the same refresh token used a second time', async () => {
      const registered = await registerStudent().expect(201);
      const jar = cookiesFrom(registered);
      const original = cookieHeader(jar, [REFRESH_TOKEN_COOKIE]);

      await request(harness.server).post(REFRESH).set('Cookie', original).expect(200);

      const replay = await request(harness.server)
        .post(REFRESH)
        .set('Cookie', original)
        .expect(401);
      expect(replay.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('kills the whole family when a used token is replayed', async () => {
      const registered = await registerStudent().expect(201);
      const firstJar = cookiesFrom(registered);

      const refreshed = await request(harness.server)
        .post(REFRESH)
        .set('Cookie', cookieHeader(firstJar, [REFRESH_TOKEN_COOKIE]))
        .expect(200);
      const secondJar = cookiesFrom(refreshed);

      // Someone replays the stolen first token.
      await request(harness.server)
        .post(REFRESH)
        .set('Cookie', cookieHeader(firstJar, [REFRESH_TOKEN_COOKIE]))
        .expect(401);

      // The legitimate holder's token is revoked too: both must sign in again.
      await request(harness.server)
        .post(REFRESH)
        .set('Cookie', cookieHeader(secondJar, [REFRESH_TOKEN_COOKIE]))
        .expect(401);

      const active = await harness.prisma.refreshToken.count({ where: { revokedAt: null } });
      expect(active).toBe(0);
    });

    it('rejects a request with no refresh cookie at all', async () => {
      await request(harness.server).post(REFRESH).expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the refresh token and clears both cookies', async () => {
      const registered = await registerStudent().expect(201);
      const jar = cookiesFrom(registered);

      const response = await request(harness.server)
        .post(LOGOUT)
        .set('Cookie', cookieHeader(jar, [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]))
        .expect(200);

      const cleared = cookiesFrom(response);
      expect(cleared[ACCESS_TOKEN_COOKIE]).toBe('');
      expect(cleared[REFRESH_TOKEN_COOKIE]).toBe('');

      await request(harness.server)
        .post(REFRESH)
        .set('Cookie', cookieHeader(jar, [REFRESH_TOKEN_COOKIE]))
        .expect(401);
    });
  });

  // -------------------------------------------------------------------------
  // Password reset
  // -------------------------------------------------------------------------

  describe('password reset', () => {
    beforeEach(async () => {
      await clearMailbox();
      await registerStudent().expect(201);
    });

    it('answers the same way whether or not the address exists', async () => {
      const known = await request(harness.server)
        .post(FORGOT)
        .send({ email: STUDENT.email })
        .expect(200);
      const unknown = await request(harness.server)
        .post(FORGOT)
        .send({ email: 'nobody@example.com' })
        .expect(200);

      expect(known.body.message).toBe(unknown.body.message);
      expect(known.body.message).toContain('ถ้าอีเมลนี้มีบัญชีอยู่ในระบบ');

      // Only the real account produced a token.
      expect(await harness.prisma.passwordResetToken.count()).toBe(1);
    });

    it('emails a Thai reset link that sets a working new password', async () => {
      await request(harness.server).post(FORGOT).send({ email: STUDENT.email }).expect(200);

      const message = await waitForMessage();
      const body = messageBody(message);
      expect(body).toContain('ตั้งรหัสผ่านใหม่');
      expect(body).toContain('#1E3A5C');

      const token = extractResetToken(message);
      // What was emailed is not what was stored.
      const stored = await harness.prisma.passwordResetToken.findFirst();
      expect(stored?.tokenHash).not.toBe(token);

      const reset = await request(harness.server)
        .post(RESET)
        .send({ token, password: 'BrandNew@2024' })
        .expect(200);
      expect(reset.body.message).toContain('ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว');

      await loginAs(STUDENT.email, STUDENT.password).expect(401);
      await loginAs(STUDENT.email, 'BrandNew@2024').expect(200);
    });

    it('signs out every existing session when the password changes', async () => {
      const login = await loginAs(STUDENT.email, STUDENT.password).expect(200);
      const jar = cookiesFrom(login);

      await request(harness.server).post(FORGOT).send({ email: STUDENT.email }).expect(200);
      const token = extractResetToken(await waitForMessage());
      await request(harness.server)
        .post(RESET)
        .send({ token, password: 'BrandNew@2024' })
        .expect(200);

      await request(harness.server)
        .post(REFRESH)
        .set('Cookie', cookieHeader(jar, [REFRESH_TOKEN_COOKIE]))
        .expect(401);

      // And the access token that was live at that moment is dead too, not
      // merely unable to be renewed: revoking the refresh half alone would
      // leave the other session working for the rest of its 15 minutes.
      await request(harness.server)
        .get(ME)
        .set('Cookie', cookieHeader(jar, [ACCESS_TOKEN_COOKIE]))
        .expect(401);
    });

    it('lets a reset link be used only once', async () => {
      await request(harness.server).post(FORGOT).send({ email: STUDENT.email }).expect(200);
      const token = extractResetToken(await waitForMessage());

      await request(harness.server)
        .post(RESET)
        .send({ token, password: 'BrandNew@2024' })
        .expect(200);

      const second = await request(harness.server)
        .post(RESET)
        .send({ token, password: 'Another@2024' })
        .expect(400);
      expect(second.body.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
    });

    it('invalidates the older link when a new one is requested', async () => {
      await request(harness.server).post(FORGOT).send({ email: STUDENT.email }).expect(200);
      const firstToken = extractResetToken(await waitForMessage());

      await clearMailbox();
      await request(harness.server).post(FORGOT).send({ email: STUDENT.email }).expect(200);
      const secondToken = extractResetToken(await waitForMessage());
      expect(secondToken).not.toBe(firstToken);

      await request(harness.server)
        .post(RESET)
        .send({ token: firstToken, password: 'BrandNew@2024' })
        .expect(400);
      await request(harness.server)
        .post(RESET)
        .send({ token: secondToken, password: 'BrandNew@2024' })
        .expect(200);
    });

    it('rejects an expired link', async () => {
      await request(harness.server).post(FORGOT).send({ email: STUDENT.email }).expect(200);
      const token = extractResetToken(await waitForMessage());

      await harness.prisma.passwordResetToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      const response = await request(harness.server)
        .post(RESET)
        .send({ token, password: 'BrandNew@2024' })
        .expect(400);
      expect(response.body.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
    });

    it('sends nothing to a suspended account', async () => {
      await harness.prisma.user.update({
        where: { email: STUDENT.email },
        data: { status: UserStatus.SUSPENDED },
      });

      await request(harness.server).post(FORGOT).send({ email: STUDENT.email }).expect(200);

      expect(await harness.prisma.passwordResetToken.count()).toBe(0);
      expect(await listMessages()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Rate limiting
  // -------------------------------------------------------------------------

  describe('rate limiting', () => {
    it('blocks the sixth login attempt within a minute', async () => {
      await registerStudent().expect(201);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await loginAs(STUDENT.email, 'Wrong@9999').expect(401);
      }

      const blocked = await loginAs(STUDENT.email, STUDENT.password).expect(429);
      expect(blocked.body.code).toBe('TOO_MANY_REQUESTS');
      expect(blocked.body.message).toContain('ถี่เกินไป');
    });

    it('blocks the fourth forgot-password request within the hour', async () => {
      await clearMailbox();
      await registerStudent().expect(201);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await request(harness.server).post(FORGOT).send({ email: STUDENT.email }).expect(200);
      }

      await request(harness.server).post(FORGOT).send({ email: STUDENT.email }).expect(429);
    });

    it('does not let the strict buckets leak onto other routes', async () => {
      // Six calls in a row would trip the login bucket if it applied here.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await request(harness.server).get(ME).expect(401);
      }
    });
  });
});
