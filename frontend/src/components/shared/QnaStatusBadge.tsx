import { Check, CircleCheck, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { qnaMessages } from "@/lib/messages/qna";
import type { QnaThreadSummary } from "@/lib/qna/types";

/**
 * Where a question stands, in one pill.
 *
 * Closed wins over answered, because a closed thread needs nothing from
 * anybody. The waiting state uses the `pending` token — the palette has no
 * orange (CLAUDE.md, หัวข้อ 4), and a question nobody has answered yet is a
 * thing to get to, not an error.
 */
export function QnaStatusBadge({
  thread,
}: {
  thread: Pick<QnaThreadSummary, "isResolved" | "hasInstructorReply">;
}) {
  const { badge } = qnaMessages;

  if (thread.isResolved) {
    return (
      <Badge tone="neutral">
        <CircleCheck aria-hidden className="size-3.5" />
        {badge.resolved}
      </Badge>
    );
  }

  if (thread.hasInstructorReply) {
    return (
      <Badge tone="success">
        <Check aria-hidden className="size-3.5" />
        {badge.answered}
      </Badge>
    );
  }

  return (
    <Badge tone="pending">
      <Clock aria-hidden className="size-3.5" />
      {badge.waiting}
    </Badge>
  );
}
