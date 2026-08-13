import { apiRequest } from "@/lib/api-client";
import type { UserProfile } from "@/lib/auth/types";
import type {
  AdminCategory,
  AdminOverview,
  AdminUser,
  DailySales,
  InstructorOverview,
  PaginatedAdminUsers,
  PaginatedPendingCourses,
  PendingCourse,
  TopCourse,
  TopInstructor,
  TrialBalance,
  UserRole,
  UserStatus,
} from "./types";

/** Thin wrappers over the admin, profile and reporting endpoints. */

// --- the signed-in person's own account -------------------------------------

export function updateProfile(input: {
  displayName?: string;
  bio?: string;
  expertise?: string;
}): Promise<UserProfile> {
  return apiRequest<UserProfile>("/users/me", { method: "PATCH", body: input });
}

export function updateAvatar(avatarKey: string): Promise<UserProfile> {
  return apiRequest<UserProfile>("/users/me/avatar", { method: "PATCH", body: { avatarKey } });
}

export function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/users/me/password", {
    method: "PATCH",
    body: input,
  });
}

// --- users ------------------------------------------------------------------

export function listUsers(options: {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  page?: number;
}): Promise<PaginatedAdminUsers> {
  const params = new URLSearchParams();
  if (options.role) {
    params.set("role", options.role);
  }
  if (options.status) {
    params.set("status", options.status);
  }
  if (options.search) {
    params.set("search", options.search);
  }
  params.set("page", String(options.page ?? 1));

  return apiRequest<PaginatedAdminUsers>(`/admin/users?${params.toString()}`);
}

export function setUserStatus(userId: string, status: UserStatus): Promise<AdminUser> {
  return apiRequest<AdminUser>(`/admin/users/${userId}/status`, {
    method: "PATCH",
    body: { status },
  });
}

/** The rate travels as a string the whole way; it is multiplied by money. */
export function setUserCommission(userId: string, commissionRate: string): Promise<AdminUser> {
  return apiRequest<AdminUser>(`/admin/users/${userId}/commission`, {
    method: "PATCH",
    body: { commissionRate },
  });
}

// --- course review ----------------------------------------------------------

export function listPendingCourses(page = 1): Promise<PaginatedPendingCourses> {
  return apiRequest<PaginatedPendingCourses>(`/admin/courses/pending?page=${page}`);
}

export function approveCourse(courseId: string): Promise<PendingCourse> {
  return apiRequest<PendingCourse>(`/admin/courses/${courseId}/approve`, { method: "PATCH" });
}

export function rejectCourse(courseId: string, reason: string): Promise<PendingCourse> {
  return apiRequest<PendingCourse>(`/admin/courses/${courseId}/reject`, {
    method: "PATCH",
    body: { reason },
  });
}

// --- categories -------------------------------------------------------------

export function listAdminCategories(): Promise<AdminCategory[]> {
  return apiRequest<AdminCategory[]>("/admin/categories");
}

export function createCategory(input: { name: string; slug?: string }): Promise<AdminCategory> {
  return apiRequest<AdminCategory>("/admin/categories", { method: "POST", body: input });
}

export function updateCategory(
  categoryId: string,
  input: { name?: string; slug?: string },
): Promise<AdminCategory> {
  return apiRequest<AdminCategory>(`/admin/categories/${categoryId}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteCategory(categoryId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/admin/categories/${categoryId}`, {
    method: "DELETE",
  });
}

// --- reports ----------------------------------------------------------------

function rangeQuery(range: { from?: string; to?: string }): string {
  const params = new URLSearchParams();
  if (range.from) {
    params.set("from", range.from);
  }
  if (range.to) {
    params.set("to", range.to);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getAdminOverview(range: { from?: string; to?: string }): Promise<AdminOverview> {
  return apiRequest<AdminOverview>(`/admin/reports/overview${rangeQuery(range)}`);
}

export function getDailySales(range: { from?: string; to?: string }): Promise<DailySales> {
  return apiRequest<DailySales>(`/admin/reports/sales-daily${rangeQuery(range)}`);
}

export function getTopCourses(range: { from?: string; to?: string }): Promise<TopCourse[]> {
  return apiRequest<TopCourse[]>(`/admin/reports/top-courses${rangeQuery(range)}`);
}

export function getTopInstructors(range: {
  from?: string;
  to?: string;
}): Promise<TopInstructor[]> {
  return apiRequest<TopInstructor[]>(`/admin/reports/top-instructors${rangeQuery(range)}`);
}

/** งบทดลอง — all-time, not windowed by the date range the other reports use. */
export function getTrialBalance(): Promise<TrialBalance> {
  return apiRequest<TrialBalance>("/admin/reports/ledger");
}

export function getInstructorOverview(): Promise<InstructorOverview> {
  return apiRequest<InstructorOverview>("/instructor/reports/overview");
}
