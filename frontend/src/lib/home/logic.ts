import type { MyEnrollment } from "@/lib/wallet/types";

/**
 * Above this count, the admin pending-summary escalates from "pending" to
 * "destructive" — a queue that big is no longer a routine end-of-day chore.
 */
const ADMIN_PENDING_ESCALATE_THRESHOLD = 10;

/**
 * Which course /home's "resume learning" card should show, if any.
 *
 * "In progress" means started but not finished; among those, the one
 * touched most recently wins — not the one bought most recently, since
 * `listMyEnrollments()` is ordered by purchase date, not study activity.
 * Returns undefined when there is nothing to resume (nothing in progress),
 * which the caller renders as no section at all, never an empty state.
 */
export function pickResumeCourse(enrollments: MyEnrollment[]): MyEnrollment | undefined {
  return enrollments
    .filter((item) => item.progressPercent > 0 && item.progressPercent < 100)
    .reduce<MyEnrollment | undefined>((latest, item) => {
      if (!latest) return item;
      return new Date(item.lastActivityAt) > new Date(latest.lastActivityAt) ? item : latest;
    }, undefined);
}

export interface AdminPendingCounts {
  topups: number;
  courses: number;
  contentReports: number;
}

export interface AdminPendingSummary {
  total: number;
  tone: "pending" | "destructive";
  /** Where the banner sends the admin: whichever queue is largest right now. */
  href: "/admin/topups" | "/admin/courses" | "/admin/content-reports";
}

/**
 * Rolls up the three queues an admin can have pending work in. Returns null
 * when every queue is empty, which the caller renders as no banner at all.
 */
export function summarizeAdminPending(counts: AdminPendingCounts): AdminPendingSummary | null {
  const total = counts.topups + counts.courses + counts.contentReports;
  if (total === 0) {
    return null;
  }

  const queues: { count: number; href: AdminPendingSummary["href"] }[] = [
    { count: counts.topups, href: "/admin/topups" },
    { count: counts.courses, href: "/admin/courses" },
    { count: counts.contentReports, href: "/admin/content-reports" },
  ];
  const busiest = queues.reduce((max, queue) => (queue.count > max.count ? queue : max));

  return {
    total,
    tone: total > ADMIN_PENDING_ESCALATE_THRESHOLD ? "destructive" : "pending",
    href: busiest.href,
  };
}
