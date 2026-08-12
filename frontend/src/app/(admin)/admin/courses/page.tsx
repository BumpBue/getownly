import type { Metadata } from "next";
import { adminMessages } from "@/lib/messages/admin";
import { CourseReviewQueue } from "./CourseReviewQueue";

export const metadata: Metadata = {
  title: adminMessages.courses.title,
};

export default function AdminCoursesPage() {
  return <CourseReviewQueue />;
}
