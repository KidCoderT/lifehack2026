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

/** Logged-in user + their profile. Sends first-time users to pick a username. */
export async function requireProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url, groups(name, emoji)")
    .eq("id", user.id)
    .single();

  if (!profile?.username) redirect("/onboarding");

  // ponytail: no generated DB types, so the embed's shape is inferred as an array.
  const group = [profile.groups].flat()[0] as { name: string; emoji: string } | undefined;

  return { supabase, user, profile, group };
}
