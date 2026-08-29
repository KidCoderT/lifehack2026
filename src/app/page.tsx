import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient, requireProfile } from "@/lib/supabase/server";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function Home() {
  const { profile } = await requireProfile();
  // ponytail: no generated DB types, so the embed's shape is inferred as an array.
  const group = [profile.groups].flat()[0];

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt=""
              width={48}
              height={48}
              unoptimized
              className="size-12 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full bg-zinc-900">
              🌱
            </span>
          )}
          <div>
            <p className="text-sm text-zinc-400">Hey</p>
            <h1 className="text-2xl font-bold tracking-tight">{profile.username}</h1>
          </div>
        </div>
        <form action={signOut}>
          <button className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-zinc-400">
            Sign out
          </button>
        </form>
      </header>

      {group && (
        <div className="rounded-3xl bg-gradient-to-br from-lime-400 to-emerald-500 p-6 text-black">
          <p className="text-sm font-medium opacity-70">Your group</p>
          <p className="mt-1 text-2xl font-bold">
            {group.emoji} {group.name}
          </p>
        </div>
      )}

      {/* ponytail: the game loop lives here next — daily challenge, streak, group leaderboard. */}
      <div className="rounded-3xl border border-dashed border-zinc-800 p-6 text-center text-zinc-500">
        <p className="text-4xl">🔥</p>
        <p className="mt-2">Today&apos;s challenge drops here.</p>
      </div>
    </main>
  );
}
