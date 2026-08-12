import type { Metadata } from "next";
import { adminMessages } from "@/lib/messages/admin";
import { InstructorReportsView } from "./InstructorReportsView";

export const metadata: Metadata = {
  title: adminMessages.instructorReports.title,
};

export default function InstructorReportsPage() {
  return <InstructorReportsView />;
}
