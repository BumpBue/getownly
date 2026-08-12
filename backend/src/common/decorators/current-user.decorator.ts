import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedUser, RequestWithUser } from '../types/authenticated-user';

/**
 * Injects the signed-in user into a controller argument.
 *
 * Controllers must take the caller's identity from here and never from the
 * request body (CLAUDE.md, ข้อห้าม 7).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!request.user) {
      // Only reachable if a route forgot to run behind JwtAuthGuard.
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน',
      });
    }

    return request.user;
  },
);
