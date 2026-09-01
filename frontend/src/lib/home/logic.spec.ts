import { describe, expect, it } from "vitest";
import { pickResumeCourse, summarizeAdminPending } from "./logic";
import type { MyEnrollment } from "@/lib/wallet/types";

function enrollment(overrides: Partial<MyEnrollment>): MyEnrollment {
  return {
    id: "enr-1",
    pricePaid: "0.00",
    enrolledAt: "2026-01-01T00:00:00.000Z",
    courseId: "course-1",
    courseTitle: "คอร์สทดสอบ",
    coverUrl: null,
    instructorName: "ผู้สอนทดสอบ",
    lessonCount: 10,
    completedLessonCount: 0,
    progressPercent: 0,
    totalDurationSec: 0,
    lastActivityAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("pickResumeCourse", () => {
  it("returns undefined when there are no enrollments", () => {
    expect(pickResumeCourse([])).toBeUndefined();
  });

  it("returns undefined when every course is either untouched or finished", () => {
    const items = [
      enrollment({ id: "a", progressPercent: 0 }),
      enrollment({ id: "b", progressPercent: 100 }),
    ];

    expect(pickResumeCourse(items)).toBeUndefined();
  });

  it("returns the single in-progress course", () => {
    const items = [
      enrollment({ id: "a", progressPercent: 100 }),
      enrollment({ id: "b", progressPercent: 40 }),
    ];

    expect(pickResumeCourse(items)?.id).toBe("b");
  });

  it("picks the most recently active course, not the first in-progress one in the list", () => {
    const items = [
      enrollment({ id: "a", progressPercent: 30, lastActivityAt: "2026-01-01T00:00:00.000Z" }),
      enrollment({ id: "b", progressPercent: 60, lastActivityAt: "2026-03-01T00:00:00.000Z" }),
      enrollment({ id: "c", progressPercent: 10, lastActivityAt: "2026-02-01T00:00:00.000Z" }),
    ];

    expect(pickResumeCourse(items)?.id).toBe("b");
  });
});

describe("summarizeAdminPending", () => {
  it("returns null when every queue is empty", () => {
    expect(summarizeAdminPending({ topups: 0, courses: 0, contentReports: 0 })).toBeNull();
  });

  it("sums all three queues and stays at pending tone at or under the threshold", () => {
    const summary = summarizeAdminPending({ topups: 3, courses: 2, contentReports: 5 });

    expect(summary).toEqual({ total: 10, tone: "pending", href: "/admin/content-reports" });
  });

  it("escalates to destructive tone once the total passes the threshold", () => {
    const summary = summarizeAdminPending({ topups: 6, courses: 3, contentReports: 3 });

    expect(summary?.total).toBe(12);
    expect(summary?.tone).toBe("destructive");
  });

  it("links to whichever queue is currently the largest", () => {
    expect(summarizeAdminPending({ topups: 1, courses: 5, contentReports: 2 })?.href).toBe(
      "/admin/courses",
    );
    expect(summarizeAdminPending({ topups: 7, courses: 1, contentReports: 1 })?.href).toBe(
      "/admin/topups",
    );
  });
});
