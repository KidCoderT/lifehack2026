import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { GoalBanner } from "@/components/garden/goal-banner";
import { Plot, type PlotMember } from "@/components/garden/plot";
import { earnFor, latestDay, treeStage } from "@/lib/points";

const EMPTY = Promise.resolve({ data: [], error: null });

export default async function GardenPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { supabase, user, groups } = await requireProfile();
  const groupId = Number((await params).groupId);
  const group = groups.find((g) => g.id === groupId);
  if (!group) notFound();

  const [memberships, contributions, lastDay] = await Promise.all([
    supabase.from("group_memberships").select("user_id").eq("group_id", groupId),
    supabase
      .from("ledger")
      .select("user_id, points")
      .eq("kind", "contribute")
      .eq("group_id", groupId),
    // "Yesterday" is the newest seeded reading, never the wall clock (points.ts).
    supabase
      .from("readings")
      .select("day")
      .eq("kind", "energy")
      .order("day", { ascending: false })
      .limit(1),
  ]);
  if (memberships.error) console.error("memberships query:", memberships.error);
  if (contributions.error) console.error("contributions query:", contributions.error);
  if (lastDay.error) console.error("readings day query:", lastDay.error);

  // Stable plot order: sorted user_id. Sorting by contributions would make every plot
  // jump the moment anyone gives points.
  const ids = (memberships.data ?? []).map((m) => m.user_id as string).sort();
  const day = latestDay(lastDay.data ?? []);

  const [profiles, readings] = await Promise.all([
    ids.length ? supabase.from("profiles").select("id, username, avatar_url").in("id", ids) : EMPTY,
    ids.length && day
      ? supabase
          .from("readings")
          .select("user_id, baseline, actual")
          .eq("kind", "energy")
          .eq("day", day)
          .in("user_id", ids)
      : EMPTY,
  ]);
  if (profiles.error) console.error("profiles query:", profiles.error);
  if (readings.error) console.error("readings query:", readings.error);

  const named = new Map(
    (profiles.data ?? []).map((p) => [p.id as string, p as { username: string; avatar_url: string | null }]),
  );

  // One predicate for the hot tile, the header count and the slacker highlight: no
  // points earned on the latest day. Guard the baseline — earnFor(0, 0) is NaN.
  //
  // Keep the percentage, don't just flag a boolean: the predicate is "earned zero
  // points", which rounds in anyone from ~0.5% *under* baseline upward. So the UI has
  // to be able to tell "using 6% more than usual" apart from "flagged but not actually
  // over" — see overPct below. These rows are already fetched; this costs no query.
  const over = new Map<string, number>();
  for (const r of readings.data ?? []) {
    const baseline = Number(r.baseline);
    const actual = Number(r.actual);
    if (baseline > 0 && earnFor(baseline, actual) === 0) {
      over.set(r.user_id as string, (actual / baseline - 1) * 100);
    }
  }

  const given = new Map<string, number>();
  for (const row of contributions.data ?? []) {
    given.set(row.user_id, (given.get(row.user_id) ?? 0) + row.points);
  }

  const members: PlotMember[] = ids.map((id) => {
    const contributed = given.get(id) ?? 0;
    return {
      id,
      username: named.get(id)?.username ?? "unknown",
      avatarUrl: named.get(id)?.avatar_url ?? null,
      contributed,
      stage: treeStage(contributed),
      leaking: over.has(id),
      overPct: over.get(id) ?? null,
      isMe: id === user.id,
    };
  });

  const total = (contributions.data ?? []).reduce((s, r) => s + r.points, 0);
  const leakingCount = members.filter((m) => m.leaking).length;

  return (
    <main className="flex flex-1 flex-col gap-3 px-4 py-5">
      {groups.length > 1 && (
        <nav className="flex gap-2 overflow-x-auto">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/garden/${g.id}`}
              aria-current={g.id === groupId ? "page" : undefined}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium ${
                g.id === groupId
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-muted text-muted"
              }`}
            >
              {g.emoji} {g.name}
            </Link>
          ))}
        </nav>
      )}

      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-[26px] font-bold tracking-[-0.02em]">
          {group.emoji} {group.name}
        </h1>
        <span
          className={`shrink-0 text-[12.5px] ${leakingCount > 0 ? "text-flag" : "text-muted"}`}
        >
          {leakingCount} not earning
        </span>
      </div>
      <p className="text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase">
        {members.length} trees · {total.toLocaleString()} pts grown
      </p>

      <GoalBanner
        groupName={group.name}
        goalTitle={group.goal_title}
        goalPoints={group.goal_points}
        total={total}
        memberCount={members.length}
      />

      {members.length === 0 ? (
        <Card className="text-[13px] text-muted">
          Nothing is growing here yet. Give your first points on Rewards and the plot fills in.
        </Card>
      ) : (
        <Plot members={members} groupId={groupId} groupName={group.name} />
      )}
    </main>
  );
}
