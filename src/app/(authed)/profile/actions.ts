"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/supabase/server";

/**
 * Sign out and return to the login screen.
 *
 * Goes through the SSR client from requireProfile() on purpose: `src/proxy.ts` refreshes
 * the session cookie on every request, so signing out on a fresh client would drop the
 * server session while leaving the cookie in place — and the next navigation would walk
 * straight back in. The SSR client's cookie adapter is what actually clears it.
 *
 * `redirect()` throws NEXT_REDIRECT by design; do not wrap this call in a try/catch.
 */
export async function signOut(): Promise<void> {
  const { supabase } = await requireProfile();
  await supabase.auth.signOut();
  redirect("/login");
}
