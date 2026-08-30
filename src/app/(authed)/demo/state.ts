/**
 * Read-side of the demo rig. Not a "use server" file on purpose — page.tsx and
 * actions.ts both need these, and anything exported from a server-action module
 * becomes a public POST endpoint.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/** The only account /demo answers to. Everything here mints points on other people's behalf. */
export const DEMO_EMAIL = "tejas.sunil@u.nus.edu";

type LedgerRow = { user_id: string; group_id: number | null; kind: string; points: number };

/**
 * Whole ledger, paged. PostgREST caps a select at 1000 rows and the ledger passes
 * that after a dozen Advance Days — an unpaged read would silently under-report a
 * group total, which is exactly the number `demoBoostGroup` aims at.
 */
async function ledgerRows(admin: SupabaseClient): Promise<LedgerRow[]> {
  const rows: LedgerRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("ledger")
      .select("user_id, group_id, kind, points")
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`ledger read: ${error.message}`);
    rows.push(...((data ?? []) as LedgerRow[]));
    if ((data?.length ?? 0) < 1000) return rows;
  }
}

export type DemoGroupState = {
  id: number;
  name: string;
  emoji: string;
  goalTitle: string;
  goalPoints: number;
  contributed: number;
  gap: number;
  voucherTitle: string | null;
  claimed: boolean;
};

export type DemoMember = { id: string; username: string };

/** Everything the pitch-state panel reads. One call, refreshed on every action. */
export async function demoState(userId: string) {
  const admin = createAdminClient();

  const [groupsQ, ledger, eventsQ, dayQ, vouchersQ, redemptionsQ, membersQ] = await Promise.all([
    admin.from("groups").select("id, name, emoji, goal_title, goal_points").order("id"),
    ledgerRows(admin),
    admin.from("events").select("status").eq("kind", "alert"),
    admin.from("readings").select("day").order("day", { ascending: false }).limit(1),
    admin.from("vouchers").select("id, title, group_id").eq("scope", "group"),
    admin.from("redemptions").select("voucher_id"),
    admin.from("group_memberships").select("user_id").eq("group_id", 1),
  ]);

  // A silently-failed read renders as 0, and this panel is what the presenter trusts
  // before walking on stage. Same check /vouchers does.
  for (const [what, q] of [
    ["groups", groupsQ],
    ["alerts", eventsQ],
    ["latest day", dayQ],
    ["vouchers", vouchersQ],
    ["redemptions", redemptionsQ],
    ["memberships", membersQ],
  ] as const) {
    if (q.error) console.error(`demo ${what} query:`, q.error);
  }

  const contributed = new Map<number, number>();
  let wallet = 0;
  for (const r of ledger) {
    if (r.kind === "contribute" && r.group_id !== null) {
      contributed.set(r.group_id, (contributed.get(r.group_id) ?? 0) + r.points);
    }
    if (r.user_id === userId) wallet += r.kind === "earn" ? r.points : -r.points;
  }

  const claimedVoucherIds = new Set((redemptionsQ.data ?? []).map((r) => r.voucher_id));
  const groups: DemoGroupState[] = (groupsQ.data ?? []).map((g) => {
    const total = contributed.get(g.id) ?? 0;
    const voucher = (vouchersQ.data ?? []).find((v) => v.group_id === g.id);
    return {
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      goalTitle: g.goal_title,
      goalPoints: g.goal_points,
      contributed: total,
      gap: Math.max(0, g.goal_points - total),
      voucherTitle: voucher?.title ?? null,
      claimed: voucher ? claimedVoucherIds.has(voucher.id) : false,
    };
  });

  const alerts = eventsQ.data ?? [];

  // Nudge targets come from the school-wide group (id 1) — everyone is in it.
  const memberIds = (membersQ.data ?? []).map((m) => m.user_id);
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username")
    .in("id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"])
    .order("username");
  const members: DemoMember[] = (profiles ?? []).filter(
    (p): p is DemoMember => typeof p.username === "string",
  );

  return {
    // Raw ISO string on purpose: no toLocaleDateString, no locale/timezone hydration
    // mismatch, and the ISO day is what the presenter compares against anyway.
    latestDay: dayQ.data?.[0]?.day ?? "none",
    wallet,
    openAlerts: alerts.filter((e) => e.status === "open").length,
    reportedAlerts: alerts.filter((e) => e.status === "reported").length,
    groups,
    members,
  };
}
