import { Badge } from "@/components/ui/badge";
import { walletMessages } from "@/lib/messages/wallet";
import type { TopupStatus } from "@/lib/wallet/types";

/** One status, one colour, everywhere in the system (CLAUDE.md, หัวข้อ 4). */
const TONE_BY_STATUS = {
  PENDING: "pending",
  APPROVED: "success",
  REJECTED: "destructive",
} as const;

export function TopupStatusBadge({ status }: { status: TopupStatus }) {
  return <Badge tone={TONE_BY_STATUS[status]}>{walletMessages.status[status]}</Badge>;
}
