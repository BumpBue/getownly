import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimitBucket';

/** The strict, opt-in rate limit buckets. Everything else uses the default one. */
export type RateLimitBucket = 'login' | 'forgotPassword';

/**
 * Marks a route as belonging to a strict rate limit bucket.
 *
 * Named throttlers otherwise apply to every route at once, so each strict
 * bucket skips itself unless a route asked for it by name.
 */
export const RateLimit = (bucket: RateLimitBucket) => SetMetadata(RATE_LIMIT_KEY, bucket);
