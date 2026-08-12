import { ROLES, type Role, type UserStatus } from "@getownly/shared";

// Re-exported so the rest of the app can keep importing Role/ROLES from this
// module rather than reaching into @getownly/shared directly (same pattern
// modules/ledger/ledger.errors.ts uses on the backend for a shared exception).
export { ROLES };
export type { Role };

/** The two roles a visitor may pick; ADMIN exists only through the seed. */
export const SELF_SERVICE_ROLES = ["STUDENT", "INSTRUCTOR"] as const;
export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  avatarUrl: string | null;
  bio: string | null;
  expertise: string | null;
  commissionRate: string;
  createdAt: string;
}

export interface AuthResponse {
  user: UserProfile;
}

/** Where each role lands after signing in. */
export const HOME_PATH_BY_ROLE: Record<Role, string> = {
  STUDENT: "/my-courses",
  INSTRUCTOR: "/instructor",
  ADMIN: "/admin",
};
