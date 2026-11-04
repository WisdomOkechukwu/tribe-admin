import { HeaderSkeleton, TableSkeleton, TabsSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="space-y-4"><TabsSkeleton /><TableSkeleton rows={12} /></div>
    </>
  );
}
