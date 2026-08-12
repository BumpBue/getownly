import { describe, expect, it } from 'vitest';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ForbiddenRoleException, UnauthenticatedException } from '../exceptions/auth.exceptions';
import type { AuthenticatedUser } from '../types/authenticated-user';

/** A context carrying the metadata a route would have declared, plus a caller. */
function contextFor(required: Role[] | undefined, user?: AuthenticatedUser): ExecutionContext {
  const handler = () => undefined;
  if (required) {
    Reflect.defineMetadata('roles', required, handler);
  }

  return {
    getHandler: () => handler,
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const student: AuthenticatedUser = {
  id: 'user-1',
  email: 'student@example.com',
  username: 'student',
  role: Role.STUDENT,
};

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('lets a route through when it declares no roles', () => {
    expect(guard.canActivate(contextFor(undefined, student))).toBe(true);
  });

  it('lets a caller whose role is listed through', () => {
    expect(guard.canActivate(contextFor([Role.STUDENT, Role.ADMIN], student))).toBe(true);
  });

  it('refuses a caller whose role is not listed', () => {
    expect(() => guard.canActivate(contextFor([Role.ADMIN], student))).toThrow(
      ForbiddenRoleException,
    );
  });

  it('refuses an anonymous caller on a role-gated route', () => {
    expect(() => guard.canActivate(contextFor([Role.ADMIN]))).toThrow(UnauthenticatedException);
  });
});
