import { LogOut } from "lucide-react";
import { requireProfile } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";
import ProfileForm from "@/app/onboarding/form";
import { signOut } from "./actions";

export default async function ProfilePage() {
  const { user, profile, groups } = await requireProfile();

  return (
    <main className="flex flex-col gap-3 px-4 py-5">
      <FadeIn>
        <h1 className="text-[26px] font-bold tracking-[-0.02em]">Your profile</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Your name and photo are what your community sees on your plot.
        </p>
      </FadeIn>

      <FadeIn>
        <Card>
          {/* Same form as onboarding — it already handles the canvas re-encode, the
              taken-username collision and the avatar upload. redirectTo keeps you here
              instead of bouncing to the dashboard. */}
          <ProfileForm
            userId={user.id}
            initialUsername={profile.username ?? ""}
            initialAvatarUrl={profile.avatar_url}
            submitLabel="Save changes"
            redirectTo="/profile"
          />
        </Card>
      </FadeIn>

      <FadeIn>
        <Card>
          <p className="text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase">
            Your communities
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center gap-2 text-[13.5px] font-semibold">
                <span aria-hidden>{g.emoji}</span>
                {g.name}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Communities are assigned by your organisation, so this list is not editable here.
          </p>
        </Card>
      </FadeIn>

      <FadeIn>
        {/* A plain form post, so signing out needs no client component at all. */}
        <form action={signOut}>
          <Button type="submit" variant="secondary" className="flex w-full items-center justify-center gap-2">
            <LogOut className="size-4" strokeWidth={2} />
            Sign out
          </Button>
        </form>
      </FadeIn>
    </main>
  );
}
