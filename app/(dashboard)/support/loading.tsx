import { HeaderSkeleton, PanelSkeleton, TabsSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="space-y-3"><TabsSkeleton /><PanelSkeleton className="h-[560px]" /></div>
    </>
  );
}
