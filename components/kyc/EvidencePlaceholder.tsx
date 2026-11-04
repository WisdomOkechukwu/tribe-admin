import { Icon } from "@/components/shell/icons";

/**
 * KYC images (selfie, liveness, ID scans) aren't served by the admin API yet,
 * so we say so plainly instead of showing sample art.
 */
export function EvidencePlaceholder({ canView }: { canView: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-dashed border-line px-2.5 py-1 text-[11.5px] text-muted">
      <Icon name={canView ? "eye" : "lock"} size={12} /> {canView ? "Images not available from the API yet" : "Images hidden"}
    </span>
  );
}
