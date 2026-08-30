import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { DemoControls } from "./controls";
import { DEMO_EMAIL, demoState } from "./state";

const MICRO = "text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase";

/** Never cached: the panel exists to show the state a rehearsal just left behind. */
export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const { user } = await requireProfile();
  // Unlinked but fully reachable on the deployed URL, and it mints points.
  if (user.email !== DEMO_EMAIL) notFound();

  const state = await demoState(user.id);

  return (
    <main className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-6">
      <FadeIn>
        <div className="px-1 pb-1">
          <p className={MICRO}>Control room</p>
          <h1 className="text-[26px] font-bold tracking-[-0.02em]">Pitch state</h1>
        </div>
      </FadeIn>

      {/* ---- status panel ----------------------------------------------------- */}
      <FadeIn>
        <Card className="grid grid-cols-2 gap-4">
          <div>
            <p className={MICRO}>Wallet</p>
            <p className="text-[36px] leading-none font-bold tracking-[-0.02em]">
              {state.wallet.toLocaleString()}
            </p>
          </div>
          <div>
            <p className={MICRO}>Latest day</p>
            {/* Raw ISO — an unpinned toLocaleDateString renders differently on server and
                client, fails hydration, and kills every handler on the page. */}
            <p className="pt-1 text-[22px] leading-tight font-bold tracking-[-0.02em]">
              {state.latestDay}
            </p>
          </div>
          <div>
            <p className={MICRO}>Open alerts</p>
            <p
              className={`text-[36px] leading-none font-bold tracking-[-0.02em] ${
                state.openAlerts === 0 ? "text-flag" : ""
              }`}
            >
              {state.openAlerts}
            </p>
            {state.openAlerts === 0 && (
              <p className="pt-1 text-[13px] text-flag">need 1+ for the resolve beat</p>
            )}
          </div>
          <div>
            <p className={MICRO}>Reported</p>
            <p className="text-[36px] leading-none font-bold tracking-[-0.02em]">
              {state.reportedAlerts}
            </p>
          </div>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card className="flex flex-col gap-4">
          <p className={MICRO}>Community goals</p>
          {state.groups.map((g) => (
            <div key={g.id}>
              <p className="text-[13.5px] font-semibold">
                {g.emoji} {g.name}
              </p>
              <p className="text-[36px] leading-none font-bold tracking-[-0.02em]">
                {g.gap.toLocaleString()}
              </p>
              <p className="pt-1 text-[13px] text-muted">
                short · {g.contributed.toLocaleString()} / {g.goalPoints.toLocaleString()}
              </p>
              <p className={`text-[13px] ${g.claimed ? "text-flag" : "text-muted"}`}>
                {g.voucherTitle ?? "no group voucher"} —{" "}
                {g.claimed ? "ALREADY CLAIMED, re-seed before the pitch" : "unclaimed"}
              </p>
            </div>
          ))}
        </Card>
      </FadeIn>

      <FadeIn>
        <Card className="text-[13px] text-muted">
          Dirty state? Run <span className="font-semibold text-foreground">bun run seed</span> in a
          terminal — that is the only reset, and it wipes the ledger, readings and events.
        </Card>
      </FadeIn>

      <DemoControls groups={state.groups} members={state.members} />
    </main>
  );
}
