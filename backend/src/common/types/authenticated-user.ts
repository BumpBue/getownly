import type { Role } from '@prisma/client';

/**
 * What the guards put on the request after a token checks out.
 *
 * Read from the database on every request, never from the token body alone,
 * so a suspension or a role change takes effect immediately instead of after
 * the access token expires.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  role: Role;
}

/** Express Request once JwtAuthGuard has run. */
export interface RequestWithUser {
  user?: AuthenticatedUser;
}
