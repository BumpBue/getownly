import { Skeleton } from "@/components/ui/skeleton";
import { courseMessages } from "@/lib/messages/courses";

/** Shown while the Server Component fetches; keeps the layout from jumping. */
export default function CoursesLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <span className="sr-only">{courseMessages.catalog.loading}</span>

      <div className="mb-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-80" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Skeleton className="h-[30rem] rounded-card" />

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-card border border-border bg-card">
              <Skeleton className="aspect-video rounded-none" />
              <div className="flex flex-col gap-3 p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
