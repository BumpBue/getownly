import type { Role, User, UserStatus } from '@prisma/client';

/**
 * The only user shape that ever leaves the API.
 *
 * Built by an explicit mapper rather than by returning the Prisma record, so
 * `passwordHash` cannot leak by accident (CLAUDE.md, ข้อห้าม 11).
 */
export interface UserProfileDto {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  avatarUrl: string | null;
  bio: string | null;
  expertise: string | null;
  /** Only meaningful for instructors; a fixed-point string, never a number. */
  commissionRate: string;
  createdAt: string;
}

export function toUserProfile(user: User): UserProfileDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    expertise: user.expertise,
    commissionRate: user.commissionRate.toFixed(4),
    createdAt: user.createdAt.toISOString(),
  };
}
