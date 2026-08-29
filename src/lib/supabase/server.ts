import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // ponytail: Server Components can't set cookies; proxy refreshes the session.
          }
        },
      },
    },
  );
}

export type Group = {
  id: number;
  name: string;
  emoji: string;
  goal_title: string;
  goal_points: number;
};

/** Logged-in user + profile + communities. Sends first-time users to pick a username. */
export async function requireProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile?.username) redirect("/onboarding");

  const { data: memberships, error } = await supabase
    .from("group_memberships")
    .select("groups(id, name, emoji, goal_title, goal_points)")
    .eq("user_id", user.id);
  if (error) console.error("memberships query:", error);

  // ponytail: no generated DB types — the only FK embed in the app, cast contained here.
  const groups = (memberships ?? []).flatMap((m) => [m.groups].flat()) as Group[];

  return { supabase, user, profile, groups };
}
