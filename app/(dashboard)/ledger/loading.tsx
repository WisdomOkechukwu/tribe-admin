import { HeaderSkeleton, TableSkeleton, TabsSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="space-y-6"><TabsSkeleton /><TableSkeleton rows={14} /></div>
    </>
  );
}
