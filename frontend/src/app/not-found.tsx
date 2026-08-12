import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { commonMessages } from "@/lib/messages/common";

/**
 * Root 404: anything Next cannot match to a route lands here, so it must not
 * depend on any route group's layout (CLAUDE.md, ข้อห้าม 19 — ห้ามข้อความอังกฤษหลุด,
 * which is exactly what Next's built-in "This page could not be found" is).
 */
export default function NotFound() {
  const { notFound } = commonMessages;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-20 sm:px-6 lg:px-8">
      <EmptyState
        icon={Compass}
        title={notFound.title}
        body={notFound.body}
        action={
          <Button asChild>
            <Link href="/">{notFound.backHome}</Link>
          </Button>
        }
      />
    </div>
  );
}
