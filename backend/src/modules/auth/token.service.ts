import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Prisma, Role } from '@prisma/client';
import { PrismaService } from '@/infra/prisma.service';
import { InvalidRefreshTokenException } from '@/common/exceptions/auth.exceptions';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessMaxAgeMs: number;
  refreshMaxAgeMs: number;
}

interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

/**
 * Issues, stores and rotates the two tokens.
 *
 * Refresh tokens are stored as a SHA-256 digest, never in the clear: a stolen
 * database dump then contains nothing that can be replayed. SHA-256 rather
 * than bcrypt is deliberate — the token is 32 random bytes, so there is no
 * low-entropy secret to slow an attacker down on, and the digest has to be
 * directly lookupable by its unique index.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Mints a fresh pair and records the refresh half against the user. */
  async issueTokens(
    user: { id: string; role: Role },
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<IssuedTokens> {
    const accessMaxAgeMs = parseDuration(this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN'));
    const refreshMaxAgeMs = parseDuration(this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'));

    const accessToken = await this.jwt.signAsync(
      // `iat` is only accurate to the second, which is not enough to tell a
      // token minted just before a password change from one minted just after.
      // `mintedAt` carries milliseconds so the guard can compare exactly.
      { sub: user.id, role: user.role, mintedAt: Date.now() },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: Math.floor(accessMaxAgeMs / 1000),
      },
    );

    // jti makes every refresh token unique even when two are minted in the
    // same second for the same user.
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti: randomBytes(16).toString('hex') },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: Math.floor(refreshMaxAgeMs / 1000),
      },
    );

    await client.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshMaxAgeMs),
      },
    });

    return { accessToken, refreshToken, accessMaxAgeMs, refreshMaxAgeMs };
  }

  /**
   * Consumes one refresh token and hands back a new pair.
   *
   * A token that is presented twice means either a replay or a stolen cookie,
   * so the whole family is revoked and the user has to sign in again.
   */
  async rotate(rawToken: string): Promise<IssuedTokens> {
    const payload = await this.verifyRefreshToken(rawToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true },
    });

    if (!stored || stored.userId !== payload.sub) {
      throw new InvalidRefreshTokenException();
    }

    if (stored.revokedAt !== null) {
      // Someone is replaying a token that was already spent, so either the
      // cookie leaked or a copy is still in flight. Kill every session for
      // this user. Deliberately outside a transaction: the throw below would
      // roll the revocation straight back.
      await revokeAllForUser(this.prisma, stored.userId);
      throw new InvalidRefreshTokenException();
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new InvalidRefreshTokenException();
    }

    return this.prisma.$transaction(async (tx) => {
      // Claiming the token with a conditional update is what makes rotation
      // atomic: two requests carrying the same token race here, and only the
      // one that flips revokedAt gets to mint the next pair.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new InvalidRefreshTokenException();
      }

      const user = await tx.user.findUnique({
        where: { id: stored.userId },
        select: { id: true, role: true },
      });
      if (!user) {
        throw new InvalidRefreshTokenException();
      }

      return this.issueTokens(user, tx);
    });
  }

  /** Signing out. An unknown or already-dead token is not an error. */
  async revoke(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Used after a password reset: every existing session must die. */
  async revokeAllForUser(userId: string): Promise<void> {
    await revokeAllForUser(this.prisma, userId);
  }

  private async verifyRefreshToken(rawToken: string): Promise<RefreshTokenPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshTokenPayload>(rawToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new InvalidRefreshTokenException();
    }
  }
}

async function revokeAllForUser(
  client: Prisma.TransactionClient | PrismaService,
  userId: string,
): Promise<void> {
  await client.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Turns "15m" / "7d" into milliseconds. */
export function parseDuration(value: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(`ระยะเวลา "${value}" ไม่ถูกต้อง ใช้รูปแบบเช่น 15m หรือ 7d`);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const unitMs: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return amount * unitMs[unit];
}
