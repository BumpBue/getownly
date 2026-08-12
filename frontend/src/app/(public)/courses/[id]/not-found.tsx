import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { courseMessages } from "@/lib/messages/courses";

export default function CourseNotFound() {
  const { detail } = courseMessages;

  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
      <EmptyState
        icon={SearchX}
        title={detail.notFoundTitle}
        body={detail.notFoundBody}
        action={
          <Button asChild variant="outline">
            <Link href="/courses">{detail.backToCatalog}</Link>
          </Button>
        }
      />
    </div>
  );
}
