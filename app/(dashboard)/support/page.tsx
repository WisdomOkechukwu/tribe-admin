import type { Metadata } from "next";
import { Gate } from "@/components/access/Gate";
import { Suspense } from "react";
import { LiveBadge } from "@/components/support/SupportControls";
import { ListSkeleton, SupportInbox } from "@/components/support/SupportInbox";
import { PageHeader } from "@/components/ui/Panel";
import { BrandLoader, TabsSkeleton } from "@/components/ui/Skeleton";
import { loadThread } from "@/lib/actions/sections";
import { settle } from "@/lib/api/client";
import { getAccess } from "@/lib/auth/current";
import { listThreads } from "@/lib/data/repo";
import { str, type SP } from "@/lib/params";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage({ searchParams }: PageProps<"/support">) {
  return (
    <>
      <PageHeader
        eyebrow="inbox"
        title="Support"
        subtitle="Tickets from the app and in-app chats, live from the API. New ones chime and pop a toast on every page. Use the bell in the top bar to mute."
        actions={<LiveBadge />}
      />
      <Suspense fallback={<InboxSkeleton />}>
        <Gate perm="support.view"><Inbox searchParams={searchParams} /></Gate>
      </Suspense>
    </>
  );
}

/** Starts the list and the open thread without waiting on either: each streams into its own pane. */
async function Inbox({ searchParams }: Pick<PageProps<"/support">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const params = { status: str(sp, "status"), channel: str(sp, "channel"), t: str(sp, "t", 40) };
  const list = settle(() => listThreads({}));
  const thread = loadThread({ t: params.t });
  const access = await getAccess();
  return <SupportInbox list={list} thread={thread} initialParams={params} canResolve={access.has("support.resolve")} canReply={access.has("support.reply")} />;
}

function InboxSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2"><TabsSkeleton /><TabsSkeleton className="w-72" /></div>
      <div className="card grid h-[calc(100dvh-300px)] min-h-[560px] grid-cols-1 overflow-hidden lg:grid-cols-[380px_1fr]">
        <ul className="border-r-2 border-line"><ListSkeleton /></ul>
        <div className="hidden place-items-center bg-sunken lg:grid"><BrandLoader text="Opening the inbox…" /></div>
      </div>
    </div>
  );
}
