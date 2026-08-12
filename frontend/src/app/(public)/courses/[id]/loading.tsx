import { Skeleton } from "@/components/ui/skeleton";
import { courseMessages } from "@/lib/messages/courses";

export default function CourseDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <span className="sr-only">{courseMessages.catalog.loading}</span>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="aspect-video w-full rounded-card" />
          <Skeleton className="h-40 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
        <Skeleton className="h-80 rounded-card" />
      </div>
    </div>
  );
}
