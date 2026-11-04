import { CardsSkeleton, HeaderSkeleton, PanelSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="space-y-6">
        <CardsSkeleton />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2"><PanelSkeleton /><PanelSkeleton /></div>
      </div>
    </>
  );
}
