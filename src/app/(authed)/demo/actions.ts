"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/supabase/server";
import { addDays, earnFor } from "@/lib/points";
import { DEMO_EMAIL } from "./state";

type Result = { ok: boolean; error?: string; message?: string };

/**
 * Server Actions are independently reachable POST endpoints — `notFound()` in page.tsx
 * gates the page, not these. Every action mints points with the service role, so each
 * one re-checks the account itself. This is the faucet lock.
 */
async function gate(): Promise<string | null> {
  const { user } = await requireProfile();
  return user.email === DEMO_EMAIL ? null : "Not the demo account.";
}

/** Every route recomputes: charts, leaderboard, garden, alerts, this panel. */
function refresh() {
  revalidatePath("/", "layout");
}

/**
 * Rolls the whole cohort forward one day. Baselines are frozen (PLAN.md §3), so each
 * user's baseline is copied from their most recent row — never recomputed. Actuals land
 * mostly under baseline so the charts move favourably.
 *
 * Double-tap safe: readings are inserted with ON CONFLICT DO NOTHING (the unique key is
 * user_id,day,kind) so the first tap's numbers stand, and any user who already has an
 * `earn` row for the new day is skipped, so a second tap never double-pays.
 */
export async function demoAdvanceDay(): Promise<Result> {
  const denied = await gate();
  if (denied) return { ok: false, error: denied };
  const admin = createAdminClient();

  // Same value as latestDay() over every row, one row off the wire instead of thousands.
  const { data: lastDay } = await admin
    .from("readings")
    .select("day")
    .order("day", { ascending: false })
    .limit(1);
  const current = lastDay?.[0]?.day;
  if (!current) return { ok: false, error: "No readings to advance from. Run `bun run seed`." };
  const next = addDays(current, 1);

  const [{ data: latest, error: readErr }, { data: paid }, { data: existing }] = await Promise.all([
    admin.from("readings").select("user_id, kind, baseline").eq("day", current),
    admin.from("ledger").select("user_id").eq("kind", "earn").eq("day", next),
    admin.from("readings").select("id").eq("day", next).limit(1),
  ]);
  if (readErr) return { ok: false, error: readErr.message };
  // The real double-tap fix. Without it the second tap keeps tap-1's readings (they are
  // upserted with DO NOTHING) but pays out on freshly rolled actuals, so the garden and
  // the leaderboard disagree — the same desync demoZeroUserSavings avoids.
  if (existing?.length) return { ok: true, message: `Already on ${next}. Nothing changed.` };
  const alreadyPaid = new Set((paid ?? []).map((r) => r.user_id));

  const readings: { user_id: string; day: string; kind: string; baseline: number; actual: number }[] =
    [];
  const earns: { user_id: string; group_id: null; kind: "earn"; points: number; day: string }[] = [];

  for (const r of latest ?? []) {
    // numeric comes back as a string, and earnFor(0, x) is NaN — which fails the
    // points > 0 check as an opaque insert error rather than a readable one.
    const baseline = Number(r.baseline);
    if (!(baseline > 0)) continue;
    const actual = +(baseline * (0.85 + Math.random() * 0.11)).toFixed(2); // 4–15% under
    readings.push({ user_id: r.user_id, day: next, kind: r.kind, baseline, actual });

    if (r.kind === "energy" && !alreadyPaid.has(r.user_id)) {
      const points = earnFor(baseline, actual);
      if (points > 0) earns.push({ user_id: r.user_id, group_id: null, kind: "earn", points, day: next });
    }
  }
  if (!readings.length) return { ok: false, error: `No usable baselines on ${current}.` };

  const { error: upErr } = await admin
    .from("readings")
    .upsert(readings, { onConflict: "user_id,day,kind", ignoreDuplicates: true });
  if (upErr) return { ok: false, error: upErr.message };

  if (earns.length) {
    const { error } = await admin.from("ledger").insert(earns);
    if (error) return { ok: false, error: error.message };
  }

  refresh();
  return {
    ok: true,
    message: `Now on ${next} — ${readings.length} readings, ${earns.length} paid.`,
  };
}

/** Raise an open waste alert at any location, in any group. The message IS the location. */
export async function demoTriggerWasteAlert(groupId: number, location: string): Promise<Result> {
  const denied = await gate();
  if (denied) return { ok: false, error: denied };
  const message = location.trim();
  if (!message) return { ok: false, error: "Give the alert a location." };

  const { error } = await createAdminClient()
    .from("events")
    .insert({ kind: "alert", group_id: groupId, message, status: "open" });
  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true, message: `Alert raised: ${message}` };
}

/**
 * Flattens a user's latest energy day to zero savings so /garden lists them as "not
 * earning" and they become nudgeable. The earn row for that day goes too — otherwise
 * the garden says they saved nothing while the leaderboard still shows their points.
 */
export async function demoZeroUserSavings(userId: string): Promise<Result> {
  const denied = await gate();
  if (denied) return { ok: false, error: denied };
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("readings")
    .select("id, day, baseline")
    .eq("user_id", userId)
    .eq("kind", "energy")
    .order("day", { ascending: false })
    .limit(1);
  if (error) return { ok: false, error: error.message };
  const row = rows?.[0];
  if (!row) return { ok: false, error: "That user has no energy readings." };

  const { error: upErr } = await admin
    .from("readings")
    .update({ actual: row.baseline })
    .eq("id", row.id);
  if (upErr) return { ok: false, error: upErr.message };

  // All three filters are load-bearing: an unfiltered delete would wipe the ledger.
  const { error: delErr } = await admin
    .from("ledger")
    .delete()
    .eq("user_id", userId)
    .eq("kind", "earn")
    .eq("day", row.day);
  if (delErr) return { ok: false, error: delErr.message };

  refresh();
  return { ok: true, message: `Zeroed ${row.day} — they are nudgeable now.` };
}

/**
 * Walks a group's contributed total up to `targetPoints`, spread across its real members.
 * The ledger is append-only, so a boost only moves a group forward — the guard below is
 * also the double-tap safety, since a second tap finds the total already at target.
 */
export async function demoBoostGroup(groupId: number, targetPoints: number): Promise<Result> {
  const denied = await gate();
  if (denied) return { ok: false, error: denied };
  if (!Number.isFinite(targetPoints) || targetPoints <= 0) {
    return { ok: false, error: "Target must be a positive number." };
  }
  const admin = createAdminClient();
  const { user } = await requireProfile();

  // ponytail: read-then-write. Two taps inside the same second both see the old total and
  // both insert the full deficit, overshooting the goal. Scoped + paged keeps the window
  // to one small query; closing it properly needs a DB function (schema.sql is not ours).
  let current = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("ledger")
      .select("points")
      .eq("kind", "contribute")
      .eq("group_id", groupId)
      .order("id")
      .range(from, from + 999);
    if (error) return { ok: false, error: error.message };
    current += (data ?? []).reduce((s, r) => s + r.points, 0);
    if ((data?.length ?? 0) < 1000) break;
  }
  if (targetPoints <= current) {
    return { ok: false, error: `Already at ${current}. Only a re-seed walks it back.` };
  }

  const { data: memberships, error } = await admin
    .from("group_memberships")
    .select("user_id")
    .eq("group_id", groupId);
  if (error) return { ok: false, error: error.message };
  // Keep the demo user's wallet out of it — his is the only balance on screen.
  const all = (memberships ?? []).map((m) => m.user_id);
  const members = all.filter((id) => id !== user.id);
  const spread = members.length ? members : all;
  if (!spread.length) return { ok: false, error: "That group has no members." };

  const deficit = targetPoints - current;
  const each = Math.floor(deficit / spread.length);
  const rows = spread
    .map((id, i) => ({
      user_id: id,
      group_id: groupId,
      kind: "contribute" as const,
      points: each + (i < deficit % spread.length ? 1 : 0),
    }))
    .filter((r) => r.points > 0);

  const { error: insErr } = await admin.from("ledger").insert(rows);
  if (insErr) return { ok: false, error: insErr.message };

  refresh();
  return { ok: true, message: `Boosted ${current} → ${targetPoints} across ${rows.length} members.` };
}

// ponytail: demoResetSeed skipped — `bun run seed` from a terminal already does it, and
// the status panel is what tells you when you need it. Add it when a terminal is not
// reachable during a pitch.
