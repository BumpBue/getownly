import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { RATE_LIMIT_KEY, type RateLimitBucket } from '@/common/decorators/rate-limit.decorator';

/**
 * Three buckets, all counted per IP address:
 *
 * - `default` is a wide safety net over every route
 * - `login` is the brute-force limit
 * - `forgotPassword` is the email-spam limit, over a much longer window
 *
 * The two strict buckets skip themselves unless a route opted in with
 * `@RateLimit(...)`; without that, a named throttler would silently apply its
 * limit to every endpoint in the API.
 */
export function buildThrottlerOptions(config: ConfigService): ThrottlerModuleOptions {
  const reflector = new Reflector();

  const skipUnlessMarked = (bucket: RateLimitBucket) => (context: ExecutionContext) =>
    reflector.getAllAndOverride<RateLimitBucket | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) !== bucket;

  const number = (key: string): number => Number(config.getOrThrow<string>(key));

  return {
    throttlers: [
      { name: 'default', ttl: 60_000, limit: 120 },
      {
        name: 'login',
        ttl: number('RATE_LIMIT_LOGIN_TTL_SECONDS') * 1000,
        limit: number('RATE_LIMIT_LOGIN_LIMIT'),
        skipIf: skipUnlessMarked('login'),
      },
      {
        name: 'forgotPassword',
        ttl: number('RATE_LIMIT_FORGOT_PASSWORD_TTL_SECONDS') * 1000,
        limit: number('RATE_LIMIT_FORGOT_PASSWORD_LIMIT'),
        skipIf: skipUnlessMarked('forgotPassword'),
      },
    ],
  };
}
