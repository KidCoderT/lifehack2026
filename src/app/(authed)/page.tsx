import Link from "next/link";
import { ChevronRight, Cloud, Droplets, Flame, Trees, Trophy, Zap } from "lucide-react";
import { requireProfile } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Tree } from "@/components/tree";
import { BarChart } from "@/components/charts/bar-chart";
import { FadeIn } from "@/components/motion/fade-in";
import { CountUp } from "@/components/fx/count-up";
import { CtaLink } from "@/components/dashboard/cta-link";
import { STAGE_NAMES, addDays, earnFor, latestDay, treeStage } from "@/lib/points";

/**
 * Singapore grid emission factor, EMA 2023: 0.4168 kg CO2 per kWh. Local const
 * because src/lib/points.ts is the points math, not an energy-physics module.
 */
const KG_CO2_PER_KWH = 0.4168;

type Day = { day: string };
const window7 = <T extends Day>(rows: T[], after: string, upTo: string) =>
  rows.filter((r) => r.day > after && r.day <= upTo);

/** Percent under the frozen baseline across a window. Baselines are never recomputed. */
function underBaselinePct(rows: { baseline: number; actual: number }[]) {
  const base = rows.reduce((s, r) => s + r.baseline, 0);
  if (!base) return 0;
  return (1 - rows.reduce((s, r) => s + r.actual, 0) / base) * 100;
}

export default async function Home() {
  const { supabase, user, profile, groups } = await requireProfile();
  const groupIds = groups.map((g) => g.id);

  const [mine, communal, allEarn, people, meter] = await Promise.all([
    supabase.from("ledger").select("kind, points, group_id, day").eq("user_id", user.id),
    // Goal bar is the whole group's contributions (AGENTS.md); the mini-tree is only
    // mine, because STAGES tops out at 1500 and every goal is 4000+ — a group-total
    // tree would sit at Blossoming forever and show nothing.
    groupIds.length
      ? supabase
          .from("ledger")
          .select("group_id, points")
          .eq("kind", "contribute")
          .in("group_id", groupIds)
      : Promise.resolve({ data: [], error: null }),
    // 354 earn rows across 22 users — well under PostgREST's 1000-row cap, so the
    // leaderboard aggregates in TS instead of needing an RPC.
    supabase.from("ledger").select("user_id, points").eq("kind", "earn"),
    supabase.from("profiles").select("id, username, avatar_url"),
    supabase
      .from("readings")
      .select("day, kind, baseline, actual")
      .eq("user_id", user.id)
      .order("day"),
  ]);
  for (const [what, q] of [
    ["ledger", mine],
    ["contributions", communal],
    ["leaderboard", allEarn],
    ["profiles", people],
    ["readings", meter],
  ] as const) {
    if (q.error) console.error(`${what} query:`, q.error);
  }

  // ---- wallet ---------------------------------------------------------------
  const ledger = mine.data ?? [];
  const total = (kind: string) => ledger.reduce((s, r) => (r.kind === kind ? s + r.points : s), 0);
  const earned = total("earn");
  const wallet = earned - total("contribute") - total("redeem");

  // ---- communities ----------------------------------------------------------
  const groupTotal = new Map<number, number>();
  for (const r of communal.data ?? []) {
    groupTotal.set(r.group_id, (groupTotal.get(r.group_id) ?? 0) + r.points);
  }
  const myGiving = new Map<number, number>();
  for (const r of ledger) {
    if (r.kind === "contribute" && r.group_id !== null) {
      myGiving.set(r.group_id, (myGiving.get(r.group_id) ?? 0) + r.points);
    }
  }

  // ---- meter ----------------------------------------------------------------
  // numeric columns come back from PostgREST as strings; coerce once, here.
  const readings = (meter.data ?? []).map((r) => ({
    day: r.day as string,
    kind: r.kind as string,
    baseline: Number(r.baseline),
    actual: Number(r.actual),
  }));
  const energy = readings.filter((r) => r.kind === "energy");
  const water = readings.filter((r) => r.kind === "water");
  // "Today" is the newest recorded day, never the wall clock.
  const today = latestDay(energy);

  const week = today ? window7(energy, addDays(today, -7), today) : [];
  const prior = today ? window7(energy, addDays(today, -14), addDays(today, -7)) : [];
  const weekPct = underBaselinePct(week);
  const deltaPp = weekPct - underBaselinePct(prior);
  const earnedThisWeek = today
    ? window7(
        ledger.filter((r) => r.kind === "earn"),
        addDays(today, -7),
        today,
      ).reduce((s, r) => s + r.points, 0)
    : 0;

  // Consecutive days under baseline, counting back from the latest reading.
  let streak = 0;
  while (today) {
    const r = energy.find((e) => e.day === addDays(today, -streak));
    if (!r || r.actual >= r.baseline) break;
    streak++;
  }

  // ---- month to date --------------------------------------------------------
  const month = today?.slice(0, 7) ?? "";
  const savedIn = (rows: typeof energy) =>
    rows
      .filter((r) => r.day.startsWith(month))
      .reduce((s, r) => s + Math.max(0, r.baseline - r.actual), 0);
  const kwhSaved = savedIn(energy);
  const litresSaved = savedIn(water);
  const monthName = today
    ? new Date(`${today}T00:00:00Z`).toLocaleString("en-SG", { month: "long", timeZone: "UTC" })
    : "";

  // ---- leaderboard ----------------------------------------------------------
  const lifetime = new Map<string, number>();
  for (const r of allEarn.data ?? []) {
    lifetime.set(r.user_id, (lifetime.get(r.user_id) ?? 0) + r.points);
  }
  const person = new Map((people.data ?? []).map((p) => [p.id as string, p]));
  const board = [...lifetime].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const myRank = board.findIndex(([id]) => id === user.id) + 1;

  return (
    <main className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-6">
      <FadeIn>
        <div className="flex items-end justify-between gap-3 px-1 pb-1">
          <div>
            <p className="text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase">
              Welcome back
            </p>
            <h1 className="text-[26px] font-bold tracking-[-0.02em]">{profile.username}</h1>
          </div>
          {streak > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-[11.5px] font-medium tracking-[0.11em] text-plot-hot uppercase">
              <Flame className="size-3.5" />
              {streak}d streak
            </span>
          )}
        </div>
      </FadeIn>

      {/* ---- wallet ---------------------------------------------------------- */}
      <FadeIn>
        <Card className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase">
                Fertilizer points
              </p>
              <p className="text-[42px] leading-none font-bold tracking-[-0.02em]">
                <CountUp value={wallet} />
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-surface-muted px-3 py-1.5 text-[11.5px] font-bold text-primary">
              +{earnedThisWeek.toLocaleString()} this week
            </span>
          </div>
          <p className="text-[13px] text-muted">
            {earned.toLocaleString()} earned all time · {(earned - wallet).toLocaleString()} already
            given or spent
          </p>
          <div className="flex flex-col gap-2">
            <CtaLink href="/vouchers">Feed your tree</CtaLink>
            <Link
              href="/energy"
              className="flex items-center justify-center gap-1 text-[13px] text-muted underline decoration-dotted underline-offset-4"
            >
              See how you earned it
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </Card>
      </FadeIn>

      {/* ---- community trees ------------------------------------------------- */}
      <FadeIn>
        <section className="flex flex-col gap-3">
          <h2 className="px-1 pt-2 text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase">
            My community trees
          </h2>
          {groups.map((g) => {
            const given = myGiving.get(g.id) ?? 0;
            const stage = treeStage(given);
            const communityPoints = groupTotal.get(g.id) ?? 0;
            return (
              <Link key={g.id} href={`/garden/${g.id}`}>
                <Card className="flex items-center gap-4">
                  <Tree stage={stage} size="sm" />
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13.5px] font-semibold">
                        {g.emoji} {g.name}
                      </p>
                      <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-[11.5px] font-medium text-primary">
                        {STAGE_NAMES[stage]}
                      </span>
                    </div>
                    <p className="text-[13px] text-muted">You gave {given.toLocaleString()} pts</p>
                    <ProgressBar value={communityPoints} max={g.goal_points} />
                    <p className="text-[13px] text-muted">
                      {g.goal_title} — {communityPoints.toLocaleString()} /{" "}
                      {g.goal_points.toLocaleString()}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
          {groups.length === 0 && (
            <Card className="text-[13px] text-muted">
              No community assigned yet. Ask your block rep to add you to one.
            </Card>
          )}
        </section>
      </FadeIn>

      {/* ---- 7-day energy ---------------------------------------------------- */}
      <FadeIn>
        <section className="flex flex-col gap-3">
          <h2 className="px-1 pt-2 text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase">
            This week vs baseline
          </h2>
          <Card className="flex flex-col gap-4">
            {week.length ? (
              <>
                <div>
                  <p className="text-[42px] leading-none font-bold tracking-[-0.02em] text-primary">
                    {weekPct >= 0 ? "−" : "+"}
                    {Math.abs(weekPct).toFixed(1)}%
                  </p>
                  <p className="pt-1 text-[13px] text-muted">
                    {weekPct >= 0 ? "under" : "over"} your frozen baseline ·{" "}
                    {deltaPp >= 0 ? "+" : "−"}
                    {Math.abs(deltaPp).toFixed(1)}pp vs last week
                  </p>
                </div>
                {/* ponytail: baselines are frozen per user (PLAN §3), so one scalar
                    covers the whole window — BarChart colours each bar against it. */}
                <BarChart
                  values={week.map((r) => r.actual)}
                  labels={week.map((r) => String(Number(r.day.slice(8))))}
                  subLabels={week.map((r) => `+${earnFor(r.baseline, r.actual)}`)}
                  baseline={week[week.length - 1].baseline}
                />
                <p className="text-[13px] text-muted">
                  kWh per day against your {week[week.length - 1].baseline.toFixed(1)} kWh baseline
                  (dashed). Every 1% under it pays 10 points — that is the row in green.
                </p>
              </>
            ) : (
              <p className="text-[13px] text-muted">
                No meter readings yet. Your EcoVolt starts logging within a day of install.
              </p>
            )}
          </Card>
        </section>
      </FadeIn>

      {/* ---- month to date --------------------------------------------------- */}
      <FadeIn>
        <section className="flex flex-col gap-3">
          <h2 className="px-1 pt-2 text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase">
            {monthName ? `${monthName} impact` : "Impact"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Energy saved"
              value={kwhSaved.toFixed(1)}
              caption="kWh below baseline"
              icon={Zap}
            />
            <StatCard
              label="Water saved"
              value={Math.round(litresSaved).toLocaleString()}
              caption="litres below baseline"
              icon={Droplets}
            />
            <StatCard
              label="CO₂ offset"
              value={(kwhSaved * KG_CO2_PER_KWH).toFixed(1)}
              caption="kg, at 0.417 kg/kWh"
              icon={Cloud}
            />
            <StatCard
              label="Trees tended"
              value={String(groups.length)}
              caption="community gardens"
              icon={Trees}
            />
          </div>
        </section>
      </FadeIn>

      {/* ---- leaderboard ----------------------------------------------------- */}
      <FadeIn>
        <section className="flex flex-col gap-3">
          <h2 className="px-1 pt-2 text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase">
            Top savers
          </h2>
          <Card className="flex flex-col gap-1 p-2">
            {board.slice(0, 5).map(([id, points], i) => {
              const p = person.get(id);
              const me = id === user.id;
              return (
                <div
                  key={id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${me ? "bg-surface-muted" : ""}`}
                >
                  <span className="w-5 text-[13.5px] font-bold text-muted">{i + 1}</span>
                  <Avatar url={p?.avatar_url} name={p?.username ?? "?"} className="size-8" />
                  <span className="flex flex-1 items-center gap-1.5 text-[13.5px] font-semibold">
                    {p?.username ?? "Unnamed saver"}
                    {i === 0 && <Trophy className="size-3.5 text-plot-hot" />}
                  </span>
                  <span className="text-[13.5px] font-bold">{points.toLocaleString()}</span>
                </div>
              );
            })}
            {board.length === 0 && (
              <p className="px-3 py-2.5 text-[13px] text-muted">Nobody has earned points yet.</p>
            )}
          </Card>
          {myRank > 0 && (
            <Card className="flex items-center gap-3 border-primary px-5 py-3">
              <span className="w-5 text-[13.5px] font-bold text-primary">{myRank}</span>
              <Avatar url={profile.avatar_url} name={profile.username} className="size-8" />
              <span className="flex-1 text-[13.5px] font-semibold">You</span>
              <span className="text-[13.5px] font-bold">{earned.toLocaleString()}</span>
            </Card>
          )}
          <p className="px-1 text-[13px] text-muted">
            {myRank > 0
              ? `#${myRank} of ${board.length} savers who have earned points, all time.`
              : "Save power this week to enter the ranking."}
          </p>
        </section>
      </FadeIn>
    </main>
  );
}
