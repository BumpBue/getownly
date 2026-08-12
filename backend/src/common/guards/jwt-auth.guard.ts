import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { UserStatus } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '@/infra/prisma.service';
import { ACCESS_TOKEN_COOKIE, readCookie } from '../cookies';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AccountSuspendedException, UnauthenticatedException } from '../exceptions/auth.exceptions';
import type { AuthenticatedUser } from '../types/authenticated-user';

/** Payload of the short-lived access token. */
export interface AccessTokenPayload {
  sub: string;
  role: string;
  /**
   * When this token was signed, in milliseconds.
   *
   * The standard `iat` claim is only accurate to the second, which cannot tell
   * a token minted just before a password change from one minted just after —
   * and both cases happen, because signing in again is the first thing anyone
   * does after changing a password.
   */
  mintedAt?: number;
}

/**
 * Whether this token predates the account's last password change.
 *
 * Tokens signed before the field existed carry no `mintedAt`; they are let
 * through rather than logging every existing session out on deploy, and they
 * expire within fifteen minutes anyway.
 */
function issuedBeforePasswordChange(
  payload: AccessTokenPayload,
  passwordChangedAt: Date | null,
): boolean {
  if (!passwordChangedAt || payload.mintedAt === undefined) {
    return false;
  }
  return payload.mintedAt < passwordChangedAt.getTime();
}

/**
 * Registered globally, so every route requires a signed-in user unless it is
 * marked `@Public()`.
 *
 * The user is re-read from the database on each request. That costs one small
 * query, and buys the guarantee that suspending an account takes effect at
 * once rather than up to 15 minutes later when the access token expires.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Request>();

    if (isPublic) {
      // A public route still wants to know *who* is looking when it can tell:
      // the course page shows its owner a draft and shows a buyer "เข้าเรียน"
      // instead of "ซื้อคอร์ส". Anything that fails here simply means the
      // viewer is a guest, which is a perfectly good answer on a public route.
      await this.attachUserIfSignedIn(request);
      return true;
    }

    const token = readCookie(request, ACCESS_TOKEN_COOKIE);
    if (!token) {
      throw new UnauthenticatedException();
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      // Expired or tampered with. The client is expected to call
      // /auth/refresh and try again.
      throw new UnauthenticatedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        passwordChangedAt: true,
      },
    });

    if (!user) {
      throw new UnauthenticatedException();
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new AccountSuspendedException();
    }
    // Changing a password ends every session, this one included. Revoking the
    // refresh tokens alone would leave this access token working for the rest
    // of its 15 minutes.
    if (issuedBeforePasswordChange(payload, user.passwordChangedAt)) {
      throw new UnauthenticatedException();
    }

    const authenticated: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };
    (request as Request & { user?: AuthenticatedUser }).user = authenticated;

    return true;
  }

  /**
   * Best-effort identification for `@Public()` routes. Never throws: a missing,
   * expired or forged cookie all mean the same thing here, which is "guest".
   */
  private async attachUserIfSignedIn(request: Request): Promise<void> {
    const token = readCookie(request, ACCESS_TOKEN_COOKIE);
    if (!token) {
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          status: true,
          passwordChangedAt: true,
        },
      });

      if (
        user &&
        user.status !== UserStatus.SUSPENDED &&
        !issuedBeforePasswordChange(payload, user.passwordChangedAt)
      ) {
        (request as Request & { user?: AuthenticatedUser }).user = {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
        };
      }
    } catch {
      // Guest. Nothing to attach.
    }
  }
}
