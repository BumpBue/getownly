import { Badge } from "@/components/ui/badge";
import { courseMessages } from "@/lib/messages/courses";
import type { CourseStatus } from "@/lib/catalog/types";

/** One status, one colour, everywhere in the system (CLAUDE.md, หัวข้อ 4). */
const TONE_BY_STATUS = {
  DRAFT: "neutral",
  PENDING_REVIEW: "pending",
  PUBLISHED: "success",
  REJECTED: "destructive",
  UNPUBLISHED: "neutral",
} as const;

export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  return <Badge tone={TONE_BY_STATUS[status]}>{courseMessages.status[status]}</Badge>;
}
