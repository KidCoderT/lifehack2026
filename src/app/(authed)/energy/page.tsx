import { Droplets, Gauge, Zap } from "lucide-react";
import { requireProfile } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { BarChart } from "@/components/charts/bar-chart";
import { FadeIn } from "@/components/motion/fade-in";
import { addDays, earnFor, latestDay, savingsPct } from "@/lib/points";

type Row = { day: string; baseline: number; actual: number };

/** The 14 newest readings of one kind. "Newest" is the latest row, never the wall clock. */
function lastFortnight(rows: Row[]) {
  const end = latestDay(rows);
  return end ? rows.filter((r) => r.day > addDays(end, -14) && r.day <= end) : [];
}

const dayMonth = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/**
 * −12% when under baseline, +6% when over — the sign is the direction of usage.
 * A day that rounds to zero prints a bare "0%": it can be fractionally *over*
 * baseline and still round to 0, so "−0%" would claim a saving that isn't there.
 */
const signedPct = (pct: number) => (pct === 0 ? "0%" : `${pct > 0 ? "−" : "+"}${Math.abs(pct)}%`);

export default async function EnergyPage() {
  const { supabase, user } = await requireProfile();

  const { data, error } = await supabase
    .from("readings")
    .select("day, kind, baseline, actual")
    .eq("user_id", user.id)
    .order("day");
  if (error) console.error("readings query:", error);

  // numeric columns arrive from PostgREST as strings; coerce once, here.
  const readings = (data ?? []).map((r) => ({
    day: r.day as string,
    kind: r.kind as string,
    baseline: Number(r.baseline),
    actual: Number(r.actual),
  }));

  // Water jitters independently of energy, so it gets its own window and its own
  // frozen baseline — the two metrics must never be shown as tracking each other.
  const energy = lastFortnight(readings.filter((r) => r.kind === "energy"));
  const water = lastFortnight(readings.filter((r) => r.kind === "water"));

  if (energy.length === 0) {
    return (
      <main className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-6">
        <h1 className="px-1 text-[26px] font-bold tracking-[-0.02em]">Your meter</h1>
        <Card className="text-[13px] text-muted">
          No meter readings yet. Your EcoVolt starts logging within a day of install, and points
          appear the morning after your first full day.
        </Card>
      </main>
    );
  }

  const today = energy[energy.length - 1];
  // Baselines are frozen at enrolment (PLAN §3), so one scalar covers the whole window.
  const baseline = today.baseline;
  const todayPct = savingsPct(baseline, today.actual);
  const todayPts = earnFor(baseline, today.actual);
  const fortnightPts = energy.reduce((s, r) => s + earnFor(r.baseline, r.actual), 0);
  const kwhSaved = energy.reduce((s, r) => s + Math.max(0, r.baseline - r.actual), 0);

  // The worked example only reads as arithmetic on a day that actually paid: an
  // over-baseline day would print "6 × 10" beside "+0 pts". No paying day in the
  // fortnight means no example — the rule is stated on its own instead.
  // Safe by construction: earnFor and savingsPct round identically, so on any row
  // where earnFor > 0, savingsPct × 10 is exactly the points paid.
  const example = [...energy].reverse().find((r) => earnFor(r.baseline, r.actual) > 0);
  const examplePct = example ? savingsPct(example.baseline, example.actual) : 0;

  const waterBaseline = water.length ? water[water.length - 1].baseline : 0;
  const litresSaved = water.reduce((s, r) => s + Math.max(0, r.baseline - r.actual), 0);

  return (
    <main className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-6">
      <FadeIn>
        <div className="px-1 pb-1">
          <p className="text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase">
            Where your points come from
          </p>
          <h1 className="text-[26px] font-bold tracking-[-0.02em]">Your meter</h1>
        </div>
      </FadeIn>

      {/* ---- device banner --------------------------------------------------- */}
      <FadeIn>
        <Card className="flex items-center gap-3 py-3.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-surface-muted">
            <Gauge className="size-4 text-primary" />
          </span>
          <p className="text-[13px] text-muted">
            <span className="font-semibold text-foreground">EcoVolt EV-402</span> · last reading{" "}
            {dayMonth(today.day)} · 230V / 50Hz
          </p>
        </Card>
      </FadeIn>

      {/* ---- today vs baseline — the one dark element on the screen ----------- */}
      <FadeIn>
        <div className="rounded-2xl border border-border bg-panel p-5 text-panel-foreground">
          <p className="text-[11.5px] font-medium tracking-[0.11em] uppercase">Today vs baseline</p>
          <p className="pt-2 text-[42px] leading-none font-bold tracking-[-0.02em]">
            {signedPct(todayPct)}
          </p>
          <p className="pt-2 text-[13px] font-semibold">
            {/* the word branches on the raw comparison, not the rounded percent — a day
                0.4% over baseline rounds to 0% and must not be called "under". */}
            +{todayPts} pts · {today.actual > baseline ? "over" : "under"} your{" "}
            {baseline.toFixed(1)} kWh frozen baseline
          </p>
          <p className="pt-3 text-[13px]">
            You used {today.actual.toFixed(1)} kWh on {dayMonth(today.day)}.
          </p>
        </div>
      </FadeIn>

      {/* ---- 14-day energy chart ---------------------------------------------- */}
      <FadeIn>
        <section className="flex flex-col gap-3">
          <h2 className="px-1 pt-2 text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase">
            Last 14 days · electricity
          </h2>
          <Card className="flex flex-col gap-4">
            <BarChart
              values={energy.map((r) => r.actual)}
              labels={energy.map((r) => String(Number(r.day.slice(8))))}
              subLabels={energy.map((r) => `+${earnFor(r.baseline, r.actual)}`)}
              baseline={baseline}
            />
            {/* the amber sentence is conditional — a clean fortnight has no amber bar to
                point at, and naming one that isn't on screen reads as a false alarm. */}
            <p className="text-[13px] text-muted">
              kWh per day against your {baseline.toFixed(1)} kWh baseline (dashed).{" "}
              {energy.some((r) => r.actual > r.baseline)
                ? "Amber days went over it and paid nothing. "
                : "Every day stayed under it. "}
              {fortnightPts.toLocaleString()} points and {kwhSaved.toFixed(1)} kWh saved across the
              fortnight.
            </p>
          </Card>
        </section>
      </FadeIn>

      {/* ---- daily breakdown — the audit trail --------------------------------- */}
      <FadeIn>
        <section className="flex flex-col gap-3">
          <h2 className="px-1 pt-2 text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase">
            Daily breakdown
          </h2>
          <Card className="flex flex-col gap-1 p-2">
            <div className="flex items-center gap-2 px-3 pt-1 pb-2 text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase">
              <span className="w-14">Day</span>
              <span className="flex-1 text-right">Base</span>
              <span className="flex-1 text-right">Used</span>
              {/* "Change" not "Saved": the sign is the direction of usage, so an
                  over-baseline day prints "+4%" and must not read as a bigger saving. */}
              <span className="w-14 text-right">Change</span>
              <span className="w-14 text-right">Points</span>
            </div>
            {energy.map((r) => {
              const pct = savingsPct(r.baseline, r.actual);
              const pts = earnFor(r.baseline, r.actual);
              return (
                <div
                  key={r.day}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] ${
                    pts === 0 ? "bg-surface-muted" : ""
                  }`}
                >
                  <span className="w-14 font-semibold">{dayMonth(r.day)}</span>
                  <span className="flex-1 text-right text-muted">{r.baseline.toFixed(1)}</span>
                  <span className="flex-1 text-right">{r.actual.toFixed(1)}</span>
                  {/* flagged on the raw comparison so the row agrees with its amber bar,
                      which BarChart colours on actual > baseline, not on the rounding. */}
                  <span
                    className={`w-14 text-right ${r.actual > r.baseline ? "text-flag" : "text-muted"}`}
                  >
                    {signedPct(pct)}
                  </span>
                  <span
                    className={`w-14 text-right font-bold ${pts > 0 ? "text-primary" : "text-muted"}`}
                  >
                    +{pts}
                  </span>
                </div>
              );
            })}
          </Card>
          <p className="px-1 text-[13px] text-muted">
            Base and used are kWh. A day at or over your baseline pays +0 — the meter never takes
            points back.
          </p>
        </section>
      </FadeIn>

      {/* ---- water — display only, earns nothing ------------------------------- */}
      <FadeIn>
        <section className="flex flex-col gap-3">
          <h2 className="px-1 pt-2 text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase">
            Last 14 days · water
          </h2>
          <Card className="flex flex-col gap-4">
            {water.length ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[36px] leading-none font-bold tracking-[-0.02em]">
                      {Math.round(litresSaved).toLocaleString()}
                    </p>
                    <p className="pt-1 text-[13px] text-muted">litres under baseline in 14 days</p>
                  </div>
                  <Droplets className="size-5 shrink-0 text-primary" />
                </div>
                <BarChart
                  values={water.map((r) => r.actual)}
                  labels={water.map((r) => String(Number(r.day.slice(8))))}
                  baseline={waterBaseline}
                />
                <p className="text-[13px] text-muted">
                  Litres per day against your {Math.round(waterBaseline)} L baseline (dashed), read
                  on its own days — water moves independently of electricity. Water earns no points
                  in v1; only electricity mints fertilizer points.
                </p>
              </>
            ) : (
              <p className="text-[13px] text-muted">
                No water readings yet. Water is tracked for your own record — it earns no points in
                v1.
              </p>
            )}
          </Card>
        </section>
      </FadeIn>

      {/* ---- conversion explainer ---------------------------------------------- */}
      <FadeIn>
        <section className="flex flex-col gap-3">
          <h2 className="px-1 pt-2 text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase">
            How a kWh becomes a point
          </h2>
          <Card className="flex flex-col gap-4">
            <p className="text-[13.5px] font-semibold">1% under baseline = 10 points.</p>
            {example ? (
              <div className="flex flex-col gap-2 rounded-xl bg-surface-muted p-4 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">{dayMonth(example.day)} baseline</span>
                  <span className="font-semibold">{example.baseline.toFixed(1)} kWh</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">You used</span>
                  <span className="font-semibold">{example.actual.toFixed(1)} kWh</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                  <span className="text-muted">That is</span>
                  <span className="font-semibold">{signedPct(examplePct)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">{examplePct} × 10</span>
                  <span className="flex items-center gap-1.5 font-bold text-primary">
                    <Zap className="size-3.5" />+{earnFor(example.baseline, example.actual)} pts
                  </span>
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-surface-muted p-4 text-[13px] text-muted">
                No day this fortnight came in under your {baseline.toFixed(1)} kWh baseline, so
                nothing was earned. Drop 1% below it and the next morning pays 10 points.
              </p>
            )}
            <p className="text-[13px] text-muted">
              Your baseline was frozen when your EcoVolt was installed, so saving is measured
              against your own past self and never moves when you improve.
            </p>
          </Card>
        </section>
      </FadeIn>
    </main>
  );
}
