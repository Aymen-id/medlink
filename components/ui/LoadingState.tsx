import { cn } from "@/lib/utils"

type SkeletonProps = {
  readonly className?: string
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
    />
  )
}

/** Card-shaped skeleton for patient list loading states */
function PatientCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  )
}

/** Table row skeleton for file list loading states */
function FileRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 px-4">
      <Skeleton className="size-8 rounded" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-12 rounded-full" />
      <Skeleton className="h-8 w-8 rounded" />
    </div>
  )
}

/** Full-page loading with multiple card skeletons */
function PageLoadingSkeleton({ count = 6 }: { readonly count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <PatientCardSkeleton key={i} />
      ))}
    </div>
  )
}

export { Skeleton, PatientCardSkeleton, FileRowSkeleton, PageLoadingSkeleton }
