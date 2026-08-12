import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import { ForbiddenRoleException, UnauthenticatedException } from '../exceptions/auth.exceptions';
import type { RequestWithUser } from '../types/authenticated-user';

/**
 * Second half of the two-layer check: the role on the route.
 * Runs after JwtAuthGuard, so `request.user` is already the database record.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    if (!user) {
      throw new UnauthenticatedException();
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenRoleException();
    }

    return true;
  }
}
