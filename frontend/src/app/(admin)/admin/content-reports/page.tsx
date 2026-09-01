import type { Metadata } from "next";
import { adminMessages } from "@/lib/messages/admin";
import { ContentReportQueue } from "./ContentReportQueue";

export const metadata: Metadata = {
  title: adminMessages.contentReports.title,
};

export default function AdminContentReportsPage() {
  return <ContentReportQueue />;
}
