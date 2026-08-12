export const ROLES = ["STUDENT", "INSTRUCTOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

/** The two roles a visitor may pick; ADMIN exists only through the seed. */
export const SELF_SERVICE_ROLES = ["STUDENT", "INSTRUCTOR"] as const;
export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: Role;
  status: "ACTIVE" | "SUSPENDED";
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
