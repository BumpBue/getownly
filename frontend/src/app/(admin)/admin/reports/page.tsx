import type { Metadata } from "next";
import { adminMessages } from "@/lib/messages/admin";
import { ReportsView } from "./ReportsView";

export const metadata: Metadata = {
  title: adminMessages.reports.title,
};

export default function AdminReportsPage() {
  return <ReportsView />;
}
