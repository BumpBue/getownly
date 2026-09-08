import { Badge } from "@/components/ui/badge";
import { payoutMessages } from "@/lib/messages/payouts";
import type { PayoutStatus } from "@/lib/payouts/types";

/** One status, one colour, everywhere in the system (CLAUDE.md, หัวข้อ 4). */
const TONE_BY_STATUS = {
  PENDING: "pending",
  APPROVED: "success",
  REJECTED: "destructive",
  CANCELLED: "neutral",
} as const;

export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  return (
    <Badge dot tone={TONE_BY_STATUS[status]}>
      {payoutMessages.status[status]}
    </Badge>
  );
}
