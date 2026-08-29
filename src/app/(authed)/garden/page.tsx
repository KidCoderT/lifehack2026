import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

/**
 * There is no "primary group" column (group_memberships is a composite PK with no
 * ordering), so the default group is the lowest group_id the user belongs to.
 */
export default async function GardenIndex() {
  const { groups } = await requireProfile();
  const first = groups.reduce<(typeof groups)[number] | undefined>(
    (min, g) => (!min || g.id < min.id ? g : min),
    undefined,
  );

  if (!first) {
    return (
      <main className="flex flex-1 flex-col gap-3 px-4 py-5">
        <h1 className="text-[26px] font-bold tracking-[-0.02em]">Garden</h1>
        <Card className="text-[13px] text-muted">
          You are not in a community yet. Your organisation assigns you one — ask them to add you,
          then your plot appears here.
        </Card>
      </main>
    );
  }

  redirect(`/garden/${first.id}`);
}
