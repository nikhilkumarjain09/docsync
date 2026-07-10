import { Skeleton } from '@/components/ui/skeleton';

/**
 * Next.js loading UI shown instantly via React Suspense while the
 * document editor page chunk loads and hydrates. This prevents the
 * user from seeing a blank screen or feeling like the app is frozen.
 */
export default function DocumentLoading() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Toolbar skeleton */}
      <div className="border-border/50 flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-5 w-48 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
      </div>

      {/* Formatting bar skeleton */}
      <div className="border-border/30 flex items-center gap-1 border-b px-4 py-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-7 rounded-md" />
        ))}
        <div className="bg-border/40 mx-1 h-5 w-px" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`b-${i}`} className="h-7 w-7 rounded-md" />
        ))}
      </div>

      {/* Editor content skeleton */}
      <div className="flex-1 overflow-hidden px-16 py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Title */}
          <Skeleton className="h-9 w-3/5 rounded-lg" />
          {/* Paragraph lines */}
          <div className="space-y-3 pt-2">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-[92%] rounded" />
            <Skeleton className="h-4 w-[85%] rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-[78%] rounded" />
          </div>
          {/* Second block */}
          <div className="space-y-3 pt-4">
            <Skeleton className="h-6 w-2/5 rounded-md" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-[90%] rounded" />
            <Skeleton className="h-4 w-[70%] rounded" />
          </div>
          {/* Third block */}
          <div className="space-y-3 pt-4">
            <Skeleton className="h-6 w-1/3 rounded-md" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-[88%] rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
