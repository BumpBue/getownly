import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountKind, UserStatus, type User } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { PrismaService } from '@/infra/prisma.service';
import { MailService } from '@/infra/mail/mail.service';
import {
  AccountSuspendedException,
  EmailAlreadyUsedException,
  InvalidCredentialsException,
  InvalidPasswordResetTokenException,
  UnauthenticatedException,
  UsernameAlreadyUsedException,
} from '@/common/exceptions/auth.exceptions';
import { TokenService, type IssuedTokens } from './token.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { ForgotPasswordDto, ResetPasswordDto } from './dto/password.dto';
import { toUserProfile, type UserProfileDto } from './dto/user-profile.dto';

export interface AuthResult {
  user: UserProfileDto;
  tokens: IssuedTokens;
}

/**
 * Same wording whether or not the address exists, so this endpoint cannot be
 * used to find out who has an account here.
 */
export const FORGOT_PASSWORD_MESSAGE =
  'ถ้าอีเมลนี้มีบัญชีอยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว กรุณาตรวจสอบกล่องจดหมาย';

export const RESET_PASSWORD_MESSAGE =
  'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Compared against when no user matches, so a miss costs the same as a hit. */
  private decoyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
      select: { email: true, username: true },
    });

    if (existing?.email === dto.email) {
      throw new EmailAlreadyUsedException();
    }
    if (existing) {
      throw new UsernameAlreadyUsedException();
    }

    const passwordHash = await this.hashPassword(dto.password);

    // The wallet account is created with the user: every later money movement
    // assumes one exists, and there is no sensible moment to create it lazily.
    const { user, tokens } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          passwordHash,
          displayName: dto.displayName,
          role: dto.role,
        },
      });

      await tx.account.create({
        data: { ownerId: created.id, kind: AccountKind.USER_WALLET },
      });

      const issued = await this.tokens.issueTokens(created, tx);
      return { user: created, tokens: issued };
    });

    return { user: toUserProfile(user), tokens };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { username: dto.identifier }],
      },
    });

    const passwordMatches = user
      ? await compare(dto.password, user.passwordHash)
      : await compare(dto.password, await this.getDecoyHash());

    if (!user || !passwordMatches) {
      throw new InvalidCredentialsException();
    }

    // Checked only after the password is known to be right, so the endpoint
    // does not reveal that a given address belongs to a suspended account.
    if (user.status === UserStatus.SUSPENDED) {
      throw new AccountSuspendedException();
    }

    const tokens = await this.tokens.issueTokens(user);
    return { user: toUserProfile(user), tokens };
  }

  async refresh(rawRefreshToken: string | undefined): Promise<IssuedTokens> {
    if (!rawRefreshToken) {
      throw new UnauthenticatedException();
    }
    return this.tokens.rotate(rawRefreshToken);
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    await this.tokens.revoke(rawRefreshToken);
  }

  async me(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthenticatedException();
    }
    return toUserProfile(user);
  }

  /**
   * Always resolves with the same message. Whether an email was sent is
   * visible only in the mail server, never in the response.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, displayName: true, status: true },
    });

    if (user && user.status !== UserStatus.SUSPENDED) {
      await this.issuePasswordReset(user);
    }

    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = hashResetToken(dto.token);

    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });

    if (!stored || stored.usedAt !== null || stored.expiresAt.getTime() <= Date.now()) {
      throw new InvalidPasswordResetTokenException();
    }

    const passwordHash = await this.hashPassword(dto.password);

    await this.prisma.$transaction(async (tx) => {
      // updateMany with usedAt: null makes the "single use" rule atomic: two
      // requests racing on the same link, only one of them updates a row.
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: stored.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (consumed.count === 0) {
        throw new InvalidPasswordResetTokenException();
      }

      await tx.user.update({
        where: { id: stored.userId },
        data: {
          passwordHash,
          // Dates every access token already issued, so a session that was
          // open when the reset link was used stops working immediately
          // rather than at the end of its 15 minutes.
          passwordChangedAt: new Date(),
        },
      });

      // Whoever else was signed in as this user is signed out.
      await tx.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { message: RESET_PASSWORD_MESSAGE };
  }

  private async issuePasswordReset(user: {
    id: string;
    email: string;
    displayName: string;
  }): Promise<void> {
    const rawToken = randomBytes(32).toString('hex');
    const expiresInMinutes = Number(
      this.config.getOrThrow<string>('PASSWORD_RESET_EXPIRES_MINUTES'),
    );

    await this.prisma.$transaction(async (tx) => {
      // Asking again invalidates the previous link, so only the newest works.
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(rawToken),
          expiresAt: new Date(Date.now() + expiresInMinutes * 60_000),
        },
      });
    });

    const frontendOrigin = this.config.getOrThrow<string>('FRONTEND_ORIGIN');
    const resetUrl = `${frontendOrigin.replace(/\/$/, '')}/reset-password?token=${rawToken}`;

    await this.mail.sendPasswordReset(user.email, {
      displayName: user.displayName,
      resetUrl,
      expiresInMinutes,
    });

    this.logger.log(`ส่งลิงก์ตั้งรหัสผ่านใหม่ให้ผู้ใช้ ${user.id} แล้ว`);
  }

  private async hashPassword(plain: string): Promise<string> {
    return hash(plain, Number(this.config.getOrThrow<string>('BCRYPT_COST')));
  }

  /** Built once, lazily, so an unknown username still costs a full bcrypt round. */
  private async getDecoyHash(): Promise<string> {
    this.decoyHash ??= this.hashPassword(randomBytes(24).toString('hex'));
    return this.decoyHash;
  }
}

/** Reset tokens are high-entropy, so a plain digest is the right primitive. */
export function hashResetToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Re-exported so tests can assert what is stored is not what was emailed. */
export type { User };
