import { Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { GoalArt } from "./goal-art";

/**
 * The payoff of the whole loop, so it leads the garden screen rather than trailing it
 * (DESIGN.md "Screens" amended for this).
 *
 * The shortfall is the hero number at 36px. DESIGN.md: "the number that sells a screen
 * is >= 36px" — Garden previously had none, so this fixes a standing violation rather
 * than creating one, and it is the on-spec way to make the banner prominent without
 * inventing a colour. Icon is Target: Gift belongs to Rewards, Sprout to Garden and
 * Trophy to the home leaderboard, so Target is the one unbound glyph that means "goal".
 */
export function GoalBanner({
  groupName,
  goalTitle,
  goalPoints,
  total,
  memberCount,
}: {
  groupName: string;
  goalTitle: string;
  goalPoints: number;
  total: number;
  memberCount: number;
}) {
  const short = Math.max(0, goalPoints - total);
  const unlocked = short === 0;

  return (
  /* p-4 not p-5, and the badge folds into the title column: on a phone this card sits
     directly above the plot, so every row it saves is a row the inspector gets back. */
    <Card className="flex flex-col gap-2.5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <Target className="size-3.5 shrink-0 text-primary" />
            <span className="text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase">
              {unlocked ? "Unlocked" : "Group goal"}
            </span>
          </div>
          <p className="text-[15px] leading-tight font-bold">{goalTitle}</p>
          {unlocked ? (
            <p className="text-[26px] leading-none font-bold tracking-[-0.02em]">Unlocked</p>
          ) : (
            <p className="flex items-baseline gap-1.5">
              <span className="text-[36px] leading-none font-bold tracking-[-0.02em]">
                {short.toLocaleString()}
              </span>
              <span className="text-[12.5px] text-muted">points short</span>
            </p>
          )}
        </div>
        <GoalArt group={groupName} className="size-16 shrink-0" />
      </div>

      <ProgressBar value={total} max={goalPoints} />

      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-[13px] text-muted">
          {unlocked ? `Unlocked for all ${memberCount} of you.` : "Nobody gets it alone."}
        </p>
        <span className="shrink-0 text-[12.5px] text-muted">
          {total.toLocaleString()} / {goalPoints.toLocaleString()}
        </span>
      </div>
    </Card>
  );
}
