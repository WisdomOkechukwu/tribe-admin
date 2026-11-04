import { PanelSkeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return <div className="grid grid-cols-1 gap-6 xl:grid-cols-2"><TableSkeleton rows={8} /><PanelSkeleton /></div>;
}
