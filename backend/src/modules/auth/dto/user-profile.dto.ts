import type { Role, User, UserStatus } from '@prisma/client';
import type { StorageService } from '@/infra/storage/storage.service';

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

/**
 * `avatarKey` is a MinIO object key, never stored as a URL because a signed
 * URL expires - the same reason `CoursesService.signCover` exists. Async on
 * that account, so every caller now awaits it.
 */
export async function toUserProfile(user: User, storage: StorageService): Promise<UserProfileDto> {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    avatarUrl: await storage.presignGetOrNull(user.avatarKey),
    bio: user.bio,
    expertise: user.expertise,
    commissionRate: user.commissionRate.toFixed(4),
    createdAt: user.createdAt.toISOString(),
  };
}
