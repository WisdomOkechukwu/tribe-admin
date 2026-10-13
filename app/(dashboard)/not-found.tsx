import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <div className="stripes mx-auto mb-6 h-3 w-28 rounded-full [--stripe-w:8px]" aria-hidden />
      <h1 className="display text-[40px] font-bold uppercase">Not found</h1>
      <p className="mt-2 text-muted">That customer, transaction or page doesn&apos;t exist, or the link is wrong.</p>
      <div className="mt-6 flex justify-center gap-2">
        <ButtonLink href="/" variant="primary">Overview</ButtonLink>
        <ButtonLink href="/customers">Search customers</ButtonLink>
      </div>
    </div>
  );
}
