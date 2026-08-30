"use client";

import { useState, useTransition } from "react";
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dismissNudge } from "@/app/(authed)/alerts/actions";

export type NudgeRow = {
  id: number;
  message: string;
  status: "open" | "fixed" | "reported";
  createdAt: string;
};

export function NudgeCard({ nudge }: { nudge: NudgeRow }) {
  const [done, setDone] = useState(nudge.status !== "open");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-surface-muted text-canopy">
          <Sprout className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] leading-snug font-semibold">{nudge.message}</p>
          <p className="mt-1 text-[11.5px] tracking-[0.11em] text-muted uppercase">
            {new Date(nudge.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              // Locale and zone are pinned: an unpinned toLocaleDateString renders "30 Aug" on
              // the server and "Aug 30" in the browser, which fails hydration and makes React
              // regenerate the whole card — taking its click handlers with it.
              timeZone: "UTC",
            })}
          </p>
        </div>
      </div>

      {done ? (
        <p className="mt-3 text-[13px] text-muted">Acknowledged.</p>
      ) : (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          className="mt-3 w-full"
          onClick={() => {
            setError(null);
            setDone(true); // optimistic, rolled back below on failure
            startTransition(async () => {
              const res = await dismissNudge(nudge.id);
              if (!res.ok) {
                setDone(false);
                setError(res.error ?? "Couldn't dismiss that.");
              }
            });
          }}
        >
          Got it
        </Button>
      )}

      {error && <p className="mt-2 text-xs text-flag">{error}</p>}
    </Card>
  );
}
