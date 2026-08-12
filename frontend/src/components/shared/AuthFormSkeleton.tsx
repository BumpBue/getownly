/**
 * Placeholder for a form that can only be built on the client, so the pane
 * has structure instead of being blank until hydration.
 */
export function AuthFormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="mb-8 space-y-2">
        <div className="h-7 w-40 rounded-control bg-border" />
        <div className="h-4 w-64 rounded-control bg-border/60" />
      </div>

      <div className="space-y-5">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <div className="h-4 w-24 rounded-control bg-border/60" />
            <div className="h-11 w-full rounded-control border border-border bg-background" />
          </div>
        ))}
        <div className="h-11 w-full rounded-control bg-border" />
      </div>
    </div>
  );
}
