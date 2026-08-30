"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };
type CodeResult = Result & { code?: string };

type Db = Awaited<ReturnType<typeof requireProfile>>["supabase"];

/**
 * Wallet = sum(earn) − sum(contribute) − sum(redeem).
 *
 * ponytail: file-local because both spend paths need the same guard — this is not the
 * shared helper the pages were told to avoid; `/` and `/garden/[groupId]` each keep
 * their own inline copy on purpose.
 *
 * This is a UX guard, **not** a security boundary: it is a read-then-write race, and
 * `ledger`'s insert policy lets a client with its own JWT push an unbacked row straight
 * through PostgREST without this action running at all. Accepted (PLAN.md §5). Upgrade
 * path is a `security definer` function doing check + insert atomically, with the direct
 * insert policy dropped.
 */
async function walletOf(supabase: Db, userId: string): Promise<number> {
  const { data, error } = await supabase.from("ledger").select("kind, points").eq("user_id", userId);
  if (error) console.error("walletOf:", error);
  return (data ?? []).reduce((s, r) => s + (r.kind === "earn" ? r.points : -r.points), 0);
}

/** Feed a community tree. Points leave the wallet and stay as growth forever. */
export async function contributePoints(groupId: number, amount: number): Promise<Result> {
  const { supabase, user, groups } = await requireProfile();

  // `ledger` has check (points > 0), so a zero or fractional amount is a DB error, not a no-op.
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Give a whole number of points." };
  }
  if (!groups.some((g) => g.id === groupId)) return { ok: false, error: "Not your community." };
  if (amount > (await walletOf(supabase, user.id))) {
    return { ok: false, error: "That's more than you have to give." };
  }

  const { error } = await supabase.from("ledger").insert({
    user_id: user.id,
    group_id: groupId,
    kind: "contribute",
    points: amount,
  });
  if (error) {
    console.error("contributePoints:", error);
    return { ok: false, error: "Those points didn't land. Try again." };
  }

  revalidatePath("/vouchers");
  revalidatePath(`/garden/${groupId}`);
  revalidatePath("/");
  return { ok: true };
}

/** Spend wallet points on a personal voucher and hand back the code. */
export async function redeemVoucher(voucherId: number): Promise<CodeResult> {
  const { supabase, user } = await requireProfile();

  const { data: voucher, error: lookupErr } = await supabase
    .from("vouchers")
    .select("id, title, cost, scope")
    .eq("id", voucherId)
    .single();
  if (lookupErr || !voucher) {
    console.error("redeemVoucher lookup:", lookupErr);
    return { ok: false, error: "That reward is no longer listed." };
  }
  if (voucher.scope !== "personal") {
    return { ok: false, error: "Community rewards unlock at the goal, not from your wallet." };
  }
  if ((await walletOf(supabase, user.id)) < voucher.cost) {
    return { ok: false, error: `You need ${voucher.cost.toLocaleString()} points for that one.` };
  }

  // Redemption FIRST, ledger second. There is no transaction and no FK between these two
  // (IMPLEMENTATION.md:247), so the only survivable half-failure is a voucher nobody paid
  // for — never points taken with no voucher. Do not reorder these inserts.
  const { data: redemption, error: mintErr } = await supabase
    .from("redemptions")
    .insert({ user_id: user.id, voucher_id: voucher.id })
    .select("code")
    .single();
  if (mintErr || !redemption) {
    console.error("redeemVoucher redemption:", mintErr);
    return { ok: false, error: "That code didn't mint. Try again." };
  }

  // cost is 0 only for group-scope rows, but points > 0 is a check constraint — skip
  // rather than fail if a free personal reward is ever added.
  if (voucher.cost > 0) {
    const { error: ledgerErr } = await supabase.from("ledger").insert({
      user_id: user.id,
      kind: "redeem",
      points: voucher.cost,
    });
    // The code is already the user's. Log the unpaid voucher; never hide it from them by
    // returning a failure the client would roll back.
    if (ledgerErr) console.error("redeemVoucher ledger (voucher issued unpaid):", ledgerErr);
  }

  revalidatePath("/vouchers");
  revalidatePath("/");
  return { ok: true, code: redemption.code };
}

/**
 * Claim a community reward once its group has crossed the goal.
 *
 * An unlock is a THRESHOLD, not a purchase — no ledger row is written and no contributed
 * points are consumed or refunded (PLAN.md §5). That is what keeps the garden from
 * shrinking when a goal lands.
 */
export async function claimGroupVoucher(voucherId: number): Promise<CodeResult> {
  const { supabase, user, groups } = await requireProfile();

  const { data: voucher, error: lookupErr } = await supabase
    .from("vouchers")
    .select("id, scope, group_id")
    .eq("id", voucherId)
    .single();
  if (lookupErr || !voucher || voucher.scope !== "group" || voucher.group_id === null) {
    console.error("claimGroupVoucher lookup:", lookupErr);
    return { ok: false, error: "That reward is no longer listed." };
  }

  const group = groups.find((g) => g.id === voucher.group_id);
  if (!group) return { ok: false, error: "Not your community." };

  // The threshold is the WHOLE group's giving — deliberately no user_id filter here.
  const { data: contributions, error: sumErr } = await supabase
    .from("ledger")
    .select("points")
    .eq("kind", "contribute")
    .eq("group_id", group.id);
  if (sumErr) {
    console.error("claimGroupVoucher contributions:", sumErr);
    return { ok: false, error: "Couldn't read the goal. Try again." };
  }
  const given = (contributions ?? []).reduce((s, r) => s + r.points, 0);
  if (given < group.goal_points) {
    return {
      ok: false,
      error: `${(group.goal_points - given).toLocaleString()} points still short.`,
    };
  }

  // ponytail: the already-claimed guard is a read-then-write race — `redemptions` has no
  // unique index on (user_id, voucher_id). Returning the existing code makes a double tap
  // idempotent in practice; hardening it is
  // `create unique index on public.redemptions (user_id, voucher_id)`, a schema change.
  const { data: already } = await supabase
    .from("redemptions")
    .select("code")
    .eq("user_id", user.id)
    .eq("voucher_id", voucher.id)
    .limit(1);
  if (already?.length) return { ok: true, code: already[0].code };

  const { data: redemption, error } = await supabase
    .from("redemptions")
    .insert({ user_id: user.id, voucher_id: voucher.id })
    .select("code")
    .single();
  if (error || !redemption) {
    console.error("claimGroupVoucher:", error);
    return { ok: false, error: "That claim didn't land. Try again." };
  }

  revalidatePath("/vouchers");
  return { ok: true, code: redemption.code };
}
