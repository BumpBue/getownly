import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser, RequestWithUser } from '../types/authenticated-user';

/**
 * Like `@CurrentUser()` but for `@Public()` routes: returns null for a guest
 * instead of rejecting the request.
 *
 * Use it only where being signed in changes the *presentation* — never where
 * it changes permission. Anything that must be authenticated belongs on a
 * non-public route with `@CurrentUser()`.
 */
export const OptionalUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | null => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user ?? null;
  },
);
