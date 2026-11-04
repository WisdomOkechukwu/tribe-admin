import { PanelSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return <div className="grid grid-cols-1 gap-5 xl:grid-cols-2"><PanelSkeleton /><PanelSkeleton /></div>;
}
