import type { Metadata } from "next";
import { walletMessages } from "@/lib/messages/wallet";
import { AdminDashboard } from "./AdminDashboard";

export const metadata: Metadata = {
  title: walletMessages.admin.dashboard.title,
  description: walletMessages.admin.dashboard.subtitle,
};

export default function AdminHomePage() {
  return <AdminDashboard />;
}
