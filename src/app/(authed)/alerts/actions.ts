"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/supabase/server";

export type ResolveResult = { ok: boolean; points?: number; error?: string };

/**
 * Resolve a community waste alert and collect the points for it.
 *
 * Everything load-bearing happens inside the `resolve_alert` Postgres function, not here:
 * clients may never insert `earn` (the "spend own points" policy allows contribute/redeem
 * only), so a security-definer function is the single sanctioned path. It also claims the
 * alert atomically (`... and status = 'open'`), which is why two people tapping at once
 * cannot both be paid — unlike contributePoints, this is not a read-then-write race.
 *
 * A return of 0 means the function matched no row: someone already resolved it, it is not
 * an alert, or it belongs to a community you are not in. That is a normal outcome, not an
 * error, so it gets its own copy rather than a failure message.
 */
export async function resolveAlert(
  eventId: number,
  action: "fixed" | "reported",
  photoUrl?: string | null,
): Promise<ResolveResult> {
  const { supabase } = await requireProfile();

  const { data, error } = await supabase.rpc("resolve_alert", {
    p_event_id: eventId,
    p_action: action,
    p_photo_url: photoUrl ?? null,
  });

  if (error) {
    console.error("resolveAlert:", error);
    return { ok: false, error: "That didn't go through. Try again." };
  }

  const points = Number(data ?? 0);
  if (points === 0) {
    return { ok: false, error: "Someone already handled this one." };
  }

  revalidatePath("/alerts");
  revalidatePath("/"); // the award moves the wallet and the leaderboard
  return { ok: true, points };
}

/**
 * Acknowledge a leaf someone sent you.
 *
 * `status` allows only open | fixed | reported — there is no `dismissed` value and v1 does
 * not add one, so on a nudge row `fixed` means acknowledged. The existing "resolve alert"
 * update policy already permits this for the recipient (`auth.uid() = to_user`).
 * No points: acknowledging your own nudge is not a conservation action.
 */
export async function dismissNudge(eventId: number): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requireProfile();

  const { error } = await supabase
    .from("events")
    .update({ status: "fixed" })
    .eq("id", eventId)
    .eq("to_user", user.id)
    .eq("kind", "nudge");

  if (error) {
    console.error("dismissNudge:", error);
    return { ok: false, error: "Couldn't dismiss that. Try again." };
  }

  revalidatePath("/alerts");
  return { ok: true };
}
