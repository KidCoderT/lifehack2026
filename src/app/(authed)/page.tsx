import Image from "next/image";
import { Flame } from "lucide-react";
import { requireProfile } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";

export default async function Home() {
  const { profile, group } = await requireProfile();

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex items-center gap-3">
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
          <span className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-xl">
            🌱
          </span>
        )}
        <div>
          <p className="text-sm text-muted">Hey</p>
          <h1 className="text-2xl font-bold tracking-tight">{profile.username}</h1>
        </div>
      </header>

      {group && (
        <FadeIn>
          <Card className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <p className="text-sm font-medium opacity-80">Your group</p>
            <p className="mt-1 text-2xl font-bold">
              {group.emoji} {group.name}
            </p>
          </Card>
        </FadeIn>
      )}

      <FadeIn>
        {/* ponytail: static placeholder — streak/points/challenge need a real data
            model (see DESIGN.md "future pages"). Not wired to fake numbers on purpose. */}
        <Card className="items-center gap-2 text-center">
          <Flame className="mx-auto size-8 text-warn" />
          <p className="mt-2 font-medium">Today&apos;s challenge drops here</p>
          <p className="text-sm text-muted">Streak &amp; points tracking coming soon</p>
        </Card>
      </FadeIn>
    </main>
  );
}
