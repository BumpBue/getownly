import type { Metadata } from "next";
import { walletMessages } from "@/lib/messages/wallet";
import { TopupQueue } from "./TopupQueue";

export const metadata: Metadata = {
  title: walletMessages.admin.topups.title,
  description: walletMessages.admin.topups.subtitle,
};

export default function AdminTopupsPage() {
  return <TopupQueue />;
}
