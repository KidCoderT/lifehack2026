import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./form";

export default async function Onboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();
  if (profile?.username) redirect("/");

  return (
    <main className="flex flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div>
        <p className="text-5xl">✨</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Set up your profile</h1>
        <p className="mt-2 text-zinc-400">This is what your group sees on the leaderboard.</p>
      </div>
      <ProfileForm userId={user.id} />
    </main>
  );
}
