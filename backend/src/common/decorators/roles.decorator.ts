import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the listed roles.
 *
 * This is only the first of the two checks CLAUDE.md requires: the service
 * still has to prove the caller owns the specific resource it is touching.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
