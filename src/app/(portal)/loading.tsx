import { Skeleton, StatSkeletonRow } from "@/components/ui/Skeleton";

/**
 * Route-level loading state. Mirrors the shape almost every page uses — a
 * header, a KPI row and a two-column body — so the transition reads as the
 * page filling in rather than a spinner replacing it.
 */
export default function PortalLoading() {
  return (
    <div>
      <div className="mb-5">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="mt-2.5 h-3.5 w-full max-w-xl" />
      </div>

      <div className="mb-5">
        <StatSkeletonRow />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] sm:gap-5">
        <div className="flex flex-col gap-4 sm:gap-5">
          <div className="surface p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-3 h-3 w-64" />
            <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-7">
              {Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={i} className="h-16 rounded-[12px]" />
              ))}
            </div>
          </div>
          <div className="surface p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-4 h-20 w-full" />
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:gap-5">
          <div className="surface p-5">
            <Skeleton className="h-4 w-36" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="mt-1.5 h-2.5 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
