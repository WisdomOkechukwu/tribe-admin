import { CardsSkeleton, HeaderSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <CardsSkeleton n={8} />
        <Skeleton className="order-first h-96 rounded-card xl:order-none" />
      </div>
    </>
  );
}
