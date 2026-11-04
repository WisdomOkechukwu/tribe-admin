import { PanelSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return <div className="space-y-6"><PanelSkeleton /><PanelSkeleton /></div>;
}
