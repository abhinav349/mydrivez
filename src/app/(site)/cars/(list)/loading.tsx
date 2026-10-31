import { CarCardSkeleton } from "@/components/site/car-card";
import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div className="pb-24 pt-[68px]">
      <div className="border-b border-line bg-white">
        <div className="container space-y-4 py-10">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
      <div className="container mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <Skeleton className="hidden h-[600px] lg:block" />
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CarCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
