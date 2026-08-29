import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, Sprout } from "lucide-react";
import { requireProfile } from "@/lib/supabase/server";
import { BottomNav } from "@/components/nav/bottom-nav";

export default async function AuthedLayout({ children }: { children: ReactNode }) {
  const { supabase, user, groups } = await requireProfile();

  const { data: open, error } = await supabase
    .from("events")
    .select("id, kind, to_user, group_id")
    .eq("status", "open");
  if (error) console.error("events query:", error);

  const groupIds = new Set(groups.map((g) => g.id));
  const unread = (open ?? []).filter(
    (e) => (e.kind === "alert" && groupIds.has(e.group_id)) || e.to_user === user.id,
  ).length;

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-6 py-4 backdrop-blur">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Sprout className="size-5 text-canopy" strokeWidth={1.75} />
          Evergreen
        </Link>
        <Link href="/alerts" aria-label="Alerts" className="relative p-1 text-muted">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute top-0 right-0 size-2.5 rounded-full bg-plot-hot" />
          )}
        </Link>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <BottomNav />
    </>
  );
}
