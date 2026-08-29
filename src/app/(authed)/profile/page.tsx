import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient, requireProfile } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function ProfilePage() {
  const { profile, group } = await requireProfile();

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10">
      <FadeIn>
        <Card className="flex flex-col items-center gap-3 text-center">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt=""
              width={96}
              height={96}
              unoptimized
              className="size-24 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-24 items-center justify-center rounded-full bg-surface-muted text-4xl">
              🌱
            </span>
          )}
          <p className="text-2xl font-bold">{profile.username}</p>
        </Card>
      </FadeIn>

      {group && (
        <FadeIn>
          <Card>
            <p className="text-sm text-muted">Your group</p>
            <p className="mt-1 text-xl font-semibold">
              {group.emoji} {group.name}
            </p>
          </Card>
        </FadeIn>
      )}

      <form action={signOut} className="mt-auto">
        <Button variant="secondary" type="submit" className="w-full">
          Sign out
        </Button>
      </form>
    </main>
  );
}
