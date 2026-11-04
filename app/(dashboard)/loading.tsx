import { CardsSkeleton, HeaderSkeleton, PanelSkeleton } from "@/components/ui/Skeleton";

// Overview: header, KPI tiles, then the chart / by-product panels (each panel streams on its own once the page shell is in).
export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="space-y-6">
        <CardsSkeleton />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]"><PanelSkeleton /><PanelSkeleton /></div>
      </div>
    </>
  );
}
