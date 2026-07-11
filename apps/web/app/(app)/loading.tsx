import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="from-background to-muted/10 h-full overflow-y-auto bg-linear-to-b p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-10 w-1/3 rounded-xl" />
          <Skeleton className="h-4 w-1/2 rounded-lg" />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>

        {/* Quick Actions Card */}
        <div className="bg-muted/30 border-border/40 flex h-32 flex-col justify-center gap-3 rounded-3xl border p-6">
          <Skeleton className="h-6 w-1/4 rounded" />
          <Skeleton className="h-4 w-2/3 rounded" />
        </div>

        {/* Documents Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32 rounded" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>

          {/* Grid skeleton */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-[340px] rounded-2xl" />
            <Skeleton className="h-[340px] rounded-2xl" />
            <Skeleton className="h-[340px] rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
