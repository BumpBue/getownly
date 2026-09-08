import type { Metadata } from "next";
import { payoutMessages } from "@/lib/messages/payouts";
import { PayoutsView } from "./PayoutsView";

export const metadata: Metadata = {
  title: payoutMessages.instructor.title,
  description: payoutMessages.instructor.subtitle,
};

export default function InstructorPayoutsPage() {
  return <PayoutsView />;
}
