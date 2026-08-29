/**
 * Creates the demo accounts and puts each in a group. Idempotent.
 *   bun scripts/seed.ts
 * Needs SUPABASE_SECRET_KEY (Project Settings > API keys) in .env.local.
 */
import { createClient } from "@supabase/supabase-js";

const PASSWORD = "12345678";
const EMAILS = [
  "tejas.sunil@u.nus.edu",
  "sairathomas@u.nus.edu",
  "ziern_th@u.nus.edu",
  "vayuntandon@u.nus.edu",
];

for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"]) {
  const v = process.env[k];
  if (!v || v.includes("<")) throw new Error(k + " is not set in .env.local");
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: groups, error: groupErr } = await admin
  .from("groups")
  .select("id, name")
  .order("id");
if (groupErr) throw groupErr;
if (!groups?.length)
  throw new Error("No groups found — run supabase/schema.sql first.");

const { data: existing, error: listErr } = await admin.auth.admin.listUsers({
  perPage: 1000,
});
if (listErr) throw listErr;
const byEmail = new Map(existing.users.map((u) => [u.email, u.id]));

for (const [i, email] of EMAILS.entries()) {
  let id = byEmail.get(email);
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    id = data.user.id;
  }

  const group = groups[i % groups.length];
  // ponytail: only sets group_id — an existing user keeps the username they picked.
  const { error } = await admin
    .from("profiles")
    .upsert({ id, group_id: group.id });
  if (error) throw error;

  console.log(`${email} -> ${group.name}`);
}

console.log(`\nDone. Password for all: ${PASSWORD}`);
