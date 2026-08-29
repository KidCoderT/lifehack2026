import { createClient } from "@supabase/supabase-js";

/** Service-role client — bypasses RLS. Server-only (seed script + /demo actions). */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
