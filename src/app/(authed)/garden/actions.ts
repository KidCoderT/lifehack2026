"use server";

import { requireProfile } from "@/lib/supabase/server";

/**
 * Send a peer a leaf. RLS ("send nudge") requires from_user = uid, kind = 'nudge',
 * to_user not null; group_id is not-null in the schema, so it is always set here.
 *
 * ponytail: same-day de-duplication is optimistic client-side only — `events` has no
 * day column and no unique index, and Phase 2 forbids schema changes, so a reload lets
 * you nudge the same person again. Hardening it means a unique index on
 * (from_user, to_user, kind, (created_at::date)).
 */
export async function sendNudge(
  targetUserId: string,
  groupId: number,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, profile, groups } = await requireProfile();

  if (!groups.some((g) => g.id === groupId)) return { ok: false, error: "Not your community." };
  if (targetUserId === user.id) return { ok: false, error: "You can't nudge yourself." };

  const { error } = await supabase.from("events").insert({
    kind: "nudge",
    group_id: groupId,
    from_user: user.id,
    to_user: targetUserId,
    message: `${profile.username} sent you a leaf — no savings logged yesterday.`,
  });
  if (error) {
    console.error("sendNudge:", error);
    return { ok: false, error: "That leaf didn't land. Try again." };
  }

  // No revalidate: a nudge lights the recipient's bell, nothing on this page.
  return { ok: true };
}
