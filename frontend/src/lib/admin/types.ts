/**
 * The admin and reporting shapes the API returns.
 *
 * Mirrors backend/src/modules/users/dto/user-response.dto.ts,
 * backend/src/modules/reports/dto/report-response.dto.ts and the admin halves
 * of the course and category DTOs. When one side changes, change the other in
 * the same commit.
 *
 * Every amount is a fixed-point string ("1290.00"), never a number.
 */

import type { CourseStatus } from "@/lib/catalog/types";

export const USER_ROLES = ["STUDENT", "INSTRUCTOR", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  commissionRate: string;
  courseCount: number;
  enrollmentCount: number;
  createdAt: string;
}

export interface UserCounts {
  total: number;
  students: number;
  instructors: number;
  admins: number;
  suspended: number;
}

export interface PaginatedAdminUsers {
  items: AdminUser[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  counts: UserCounts;
}

// --- course review ----------------------------------------------------------

export interface ReviewLesson {
  id: string;
  title: string;
  orderIndex: number;
  durationSec: number | null;
  hasVideo: boolean;
}

export interface PendingCourse {
  id: string;
  title: string;
  description: string;
  price: string;
  coverUrl: string | null;
  status: CourseStatus;
  rejectReason: string | null;
  instructor: { id: string; displayName: string; email: string };
  category: { id: string; name: string; slug: string };
  lessonCount: number;
  lessonsWithVideo: number;
  totalDurationSec: number;
  lessons: ReviewLesson[];
  submittedAt: string;
  createdAt: string;
}

export interface PaginatedPendingCourses {
  items: PendingCourse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// --- categories -------------------------------------------------------------

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  /** Published only — what a visitor would actually find. */
  courseCount: number;
  /** Everything, drafts included. Only this decides whether it can be deleted. */
  totalCourseCount: number;
  createdAt: string;
}

// --- reports ----------------------------------------------------------------

export interface Metric {
  value: string;
  previousValue: string;
  /** Null when the previous period was zero: no percentage comes from nothing. */
  changePercent: number | null;
}

export interface ReportDateRange {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
}

export interface AdminOverview {
  range: ReportDateRange;
  grossSales: Metric;
  platformRevenue: Metric;
  instructorPayable: Metric;
  newUsers: Metric;
  salesCount: Metric;
}

export interface DailySalesPoint {
  date: string;
  grossSales: string;
  platformRevenue: string;
  salesCount: number;
}

export interface DailySales {
  range: ReportDateRange;
  points: DailySalesPoint[];
}

export interface TopCourse {
  courseId: string;
  title: string;
  instructorName: string;
  salesCount: number;
  grossSales: string;
  platformRevenue: string;
}

export interface TopInstructor {
  instructorId: string;
  displayName: string;
  salesCount: number;
  earnings: string;
  outstandingAmount: string;
}

export interface InstructorMonthPoint {
  month: string;
  label: string;
  salesCount: number;
  earnings: string;
}

export interface InstructorCourseSales {
  courseId: string;
  title: string;
  status: CourseStatus;
  salesCount: number;
  earnings: string;
  grossSales: string;
}

export interface InstructorOverview {
  totalEarnings: string;
  totalGrossSales: string;
  totalSalesCount: number;
  last30DaysEarnings: string;
  studentCount: number;
  publishedCourses: number;
  totalCourses: number;
  pendingQuestions: number;
  walletBalance: string;
  monthly: InstructorMonthPoint[];
  courses: InstructorCourseSales[];
}

/** The ranges the report screens offer, in days. */
export const REPORT_RANGES = [7, 30, 90] as const;
export type ReportRangeDays = (typeof REPORT_RANGES)[number];
