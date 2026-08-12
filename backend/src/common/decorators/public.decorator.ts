import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opens a route to anonymous callers.
 *
 * Authentication is on by default for every route (JwtAuthGuard is registered
 * globally), so forgetting this decorator fails closed.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
