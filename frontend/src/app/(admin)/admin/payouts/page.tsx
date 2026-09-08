import type { Metadata } from "next";
import { payoutMessages } from "@/lib/messages/payouts";
import { PayoutQueue } from "./PayoutQueue";

export const metadata: Metadata = {
  title: payoutMessages.admin.title,
  description: payoutMessages.admin.subtitle,
};

export default function AdminPayoutsPage() {
  return <PayoutQueue />;
}
