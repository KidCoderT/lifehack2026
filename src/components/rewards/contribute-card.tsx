"use client";

import { useState, useTransition } from "react";
import { Sprout } from "lucide-react";
import { contributePoints } from "@/app/(authed)/vouchers/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Moment } from "@/components/fx/moment";

export type ContributeTarget = {
  id: number;
  name: string;
  emoji: string;
  goalTitle: string;
  /** Points the whole group still needs. 0 once the goal is crossed. */
  shortfall: number;
};

const QUICK = [50, 100, 250];

export function ContributeCard({
  wallet,
  targets,
}: {
  wallet: number;
  targets: ContributeTarget[];
}) {
  // No "primary group" column — group_memberships is a composite PK with no ordering, so
  // PostgREST row order decides which tab is live otherwise. Lowest group_id, the same
  // tiebreak /garden already documents.
  const [targetId, setTargetId] = useState(
    () => targets.reduce((min, t) => (t.id < min.id ? t : min), targets[0])?.id ?? 0,
  );
  // Optimistic delta only. revalidatePath('/vouchers') re-renders this card with the new
  // `wallet` prop, so the delta is cleared inside the same transition — otherwise the two
  // would stack and the balance would read low by the amount just given.
  const [given, setGiven] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmMax, setConfirmMax] = useState(false);
  // Fired from the action callback, never from render state: nothing records *when* a goal
  // was crossed, so a later page load must not be able to re-fire it. Transient by design.
  const [unlocked, setUnlocked] = useState<{ name: string; goal: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const active = targets.find((t) => t.id === targetId) ?? targets[0];
  if (!active) return null;

  const left = wallet - given;
  // Max stops at the shortfall, not the wallet: one tap crosses the goal and still leaves
  // points to spend in the catalogue below. With no shortfall left, Max means everything.
  const max = Math.min(left, active.shortfall || left);
  // When the shortfall is bigger than the wallet, Max IS the wallet, and a contribute is
  // permanent — `ledger` grants insert only, and nothing in the app un-contributes. Ask
  // once before emptying it, the same two-step RedeemButton uses for a lesser spend.
  const emptiesWallet = max > 0 && max === left;

  const send = (amount: number) => {
    setError(null);
    setConfirmMax(false);
    setGiven((g) => g + amount);
    // Read before the await: revalidatePath re-renders this card with shortfall 0, so
    // checking after the action would never be true.
    const { name, goalTitle, shortfall } = active;
    const crosses = shortfall > 0 && amount >= shortfall;
    startTransition(async () => {
      const res = await contributePoints(active.id, amount);
      if (res.ok) {
        setGiven(0);
        if (crosses) setUnlocked({ name, goal: goalTitle });
      } else {
        setGiven((g) => g - amount);
        setError(res.error ?? "Those points didn't land. Try again.");
      }
    });
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase">
            Contribute points
          </p>
          <p className="pt-1 text-[13.5px] font-semibold">
            Feed {active.emoji} {active.name}
          </p>
        </div>
        <Sprout className="size-5 shrink-0 text-primary" />
      </div>

      {targets.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {targets.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={t.id === active.id}
              onClick={() => {
                setTargetId(t.id);
                setError(null);
                setConfirmMax(false);
              }}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium ${
                t.id === active.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-muted text-muted"
              }`}
            >
              {t.emoji} {t.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {QUICK.map((amount) => (
          <Button
            key={amount}
            variant="secondary"
            disabled={pending || amount > left}
            onClick={() => send(amount)}
            className="px-0 py-3 text-[13.5px]"
          >
            +{amount}
          </Button>
        ))}
        <Button
          disabled={pending || max <= 0}
          onClick={() => (emptiesWallet && !confirmMax ? setConfirmMax(true) : send(max))}
          className="px-0 py-3 text-[13.5px]"
        >
          {confirmMax ? "Sure?" : "Max"}
        </Button>
      </div>

      <p className="text-[13px] text-muted">
        {confirmMax
          ? `That is every one of your ${max.toLocaleString()} points, and giving can't be undone. Tap again to send.`
          : `${left.toLocaleString()} points left in your wallet`}
        {!confirmMax &&
          max > 0 &&
          (active.shortfall > 0
            ? left >= active.shortfall
              ? ` · Max gives ${max.toLocaleString()} and unlocks ${active.goalTitle}`
              : ` · Max gives ${max.toLocaleString()}, still ${(active.shortfall - left).toLocaleString()} short`
            : " · goal already reached, extra points keep the tree growing")}
      </p>
      {error && <p className="mt-2 text-xs text-flag">{error}</p>}

      <Moment open={!!unlocked} onClose={() => setUnlocked(null)}>
        <p className="text-[11.5px] font-medium tracking-[0.11em] uppercase">Goal reached</p>
        <p className="text-[26px] leading-tight font-bold tracking-[-0.02em]">{unlocked?.goal}</p>
        <p className="pt-1 text-[13px]">
          Unlocked for everyone in {unlocked?.name}. Nobody got it alone.
        </p>
      </Moment>
    </Card>
  );
}
