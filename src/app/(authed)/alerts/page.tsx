import Link from "next/link";
import { requireProfile } from "@/lib/supabase/server";
import { FadeIn } from "@/components/motion/fade-in";
import { AlertCard, type AlertRow } from "@/components/alerts/alert-card";
import { NudgeCard, type NudgeRow } from "@/components/alerts/nudge-card";

type Status = "open" | "fixed" | "reported";

/** Open first, then most recent — a resolved card should never push a live one down. */
function openFirst<T extends { status: Status; createdAt: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      Number(b.status === "open") - Number(a.status === "open") ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { supabase, user, groups } = await requireProfile();
  const { tab } = await searchParams;
  const showNudges = tab === "nudges";

  const { data, error } = await supabase
    .from("events")
    .select("id, kind, group_id, to_user, message, status, created_at, photo_url, resolved_by")
    .order("created_at", { ascending: false });
  if (error) console.error("alerts query:", error);

  // `events readable` is using(true), so scoping is ours to do: community alerts for the
  // groups you are in, and nudges addressed to you. Same predicate the header bell uses.
  const groupIds = new Set(groups.map((g) => g.id));
  const rows = data ?? [];

  const alerts: AlertRow[] = openFirst(
    rows
      .filter((r) => r.kind === "alert" && groupIds.has(r.group_id))
      .map((r) => ({
        id: r.id,
        message: r.message,
        status: r.status as Status,
        photoUrl: r.photo_url,
        resolvedByName: null,
        createdAt: r.created_at,
      })),
  );

  const nudges: NudgeRow[] = openFirst(
    rows
      .filter((r) => r.kind === "nudge" && r.to_user === user.id)
      .map((r) => ({
        id: r.id,
        message: r.message,
        status: r.status as Status,
        createdAt: r.created_at,
      })),
  );

  // Credit line on resolved cards. Separate query rather than an embedded resource:
  // `events` has three FKs to `profiles`, so an embed needs a constraint-name hint.
  const resolverIds = [
    ...new Set(rows.map((r) => r.resolved_by).filter(Boolean) as string[]),
  ];
  if (resolverIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", resolverIds);
    const byId = new Map((profs ?? []).map((p) => [p.id, p.username as string]));
    const resolverOf = new Map(rows.map((r) => [r.id, r.resolved_by]));
    for (const a of alerts) {
      const rid = resolverOf.get(a.id);
      a.resolvedByName = rid ? (byId.get(rid) ?? null) : null;
    }
  }

  const openAlerts = alerts.filter((a) => a.status === "open").length;
  const openNudges = nudges.filter((n) => n.status === "open").length;
  const shown = showNudges ? nudges : alerts;

  return (
    <main className="flex flex-col gap-3 px-4 py-5">
      <FadeIn>
        <h1 className="text-[26px] font-bold tracking-[-0.02em]">Inbox</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Waste your community can still stop, and leaves your peers sent you.
        </p>
      </FadeIn>

      {/* Link pills, not JS tabs — same approach as the garden's group selector. */}
      <FadeIn>
        <div className="flex gap-2">
          <Tab href="/alerts" active={!showNudges} label="Waste alerts" count={openAlerts} />
          <Tab href="/alerts?tab=nudges" active={showNudges} label="Leaves" count={openNudges} />
        </div>
      </FadeIn>

      {shown.length === 0 ? (
        <FadeIn>
          <p className="rounded-2xl border border-border bg-surface p-5 text-[13px] leading-relaxed text-muted">
            {showNudges
              ? "No leaves yet. Your community sends one when you go a day without savings."
              : "Nothing is being wasted right now. This fills up when EcoVolt spots an anomaly."}
          </p>
        </FadeIn>
      ) : (
        shown.map((row) =>
          showNudges ? (
            <NudgeCard key={row.id} nudge={row as NudgeRow} />
          ) : (
            <AlertCard key={row.id} alert={row as AlertRow} userId={user.id} />
          ),
        )
      )}
    </main>
  );
}

function Tab({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-[13px] font-semibold ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-muted"
      }`}
    >
      {label}
      {count > 0 && (
        <span
          className={`rounded-full px-1.5 text-[11px] ${
            active ? "bg-primary-foreground text-primary" : "bg-plot-hot text-bark"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
