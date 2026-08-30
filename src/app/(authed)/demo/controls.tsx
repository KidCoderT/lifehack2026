"use client";

import { useState, useTransition } from "react";
import { FastForward, Siren, Target, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  demoAdvanceDay,
  demoBoostGroup,
  demoTriggerWasteAlert,
  demoZeroUserSavings,
} from "./actions";
import type { DemoGroupState, DemoMember } from "./state";

const MICRO = "text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase";
const FIELD =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13.5px] focus:ring-2 focus:ring-primary focus:outline-none";

const PRESETS = [
  "Lights left on in Common Room (Level 3)",
  "Aircon running with the windows open",
  "Pantry kettle left on the boil",
];

type Result = { ok: boolean; error?: string; message?: string };

export function DemoControls({
  groups,
  members,
}: {
  groups: DemoGroupState[];
  members: DemoMember[];
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ key: string; ok: boolean; text: string } | null>(null);

  const [alertGroup, setAlertGroup] = useState(groups[0]?.id ?? 1);
  const [location, setLocation] = useState(PRESETS[0]);
  const [target, setTarget] = useState(
    members.find((m) => m.username === "alice.tan")?.id ?? members[0]?.id ?? "",
  );
  const [boostGroup, setBoostGroup] = useState(groups[0]?.id ?? 1);
  const [boostPoints, setBoostPoints] = useState("");

  const run = (key: string, fn: () => Promise<Result>) => {
    setBusy(key);
    setResult(null);
    startTransition(async () => {
      const res = await fn();
      setResult({ key, ok: res.ok, text: res.error ?? res.message ?? "Done." });
      setBusy(null);
    });
  };

  const note = (key: string) =>
    result?.key === key ? (
      <p className={`text-[13px] ${result.ok ? "text-primary" : "text-flag"}`}>{result.text}</p>
    ) : null;

  const boostTo = (g: DemoGroupState, pct: number) => Math.round((g.goalPoints * pct) / 100);
  const boosted = groups.find((g) => g.id === boostGroup);

  return (
    <>
      {/* ---- alert ----------------------------------------------------------- */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className={MICRO}>Trigger waste alert</p>
          <Siren className="size-5 text-primary" />
        </div>
        <select
          value={alertGroup}
          onChange={(e) => setAlertGroup(Number(e.target.value))}
          className={FIELD}
          aria-label="Alert group"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.emoji} {g.name}
            </option>
          ))}
        </select>
        <div className="flex flex-col gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={p === location}
              onClick={() => setLocation(p)}
              className={`rounded-xl px-3 py-2 text-left text-[13px] ${
                p === location ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Where is the waste?"
          className={FIELD}
          aria-label="Alert location"
        />
        <Button
          disabled={pending}
          onClick={() => run("alert", () => demoTriggerWasteAlert(alertGroup, location))}
        >
          {busy === "alert" ? "Raising…" : "Trigger waste alert"}
        </Button>
        {note("alert")}
      </Card>

      {/* ---- nudge target ---------------------------------------------------- */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className={MICRO}>Make someone nudgeable</p>
          <UserMinus className="size-5 text-primary" />
        </div>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className={FIELD}
          aria-label="Nudge target"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.username}
            </option>
          ))}
        </select>
        <Button
          disabled={pending || !target}
          onClick={() => run("zero", () => demoZeroUserSavings(target))}
        >
          {busy === "zero" ? "Zeroing…" : "Zero their savings"}
        </Button>
        <p className="text-[13px] text-muted">
          Sets their latest energy day to zero savings and removes that day&apos;s points, so the
          garden lists them as not earning.
        </p>
        {note("zero")}
      </Card>

      {/* ---- boost ----------------------------------------------------------- */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className={MICRO}>Boost group to target</p>
          <Target className="size-5 text-primary" />
        </div>
        <select
          value={boostGroup}
          onChange={(e) => setBoostGroup(Number(e.target.value))}
          className={FIELD}
          aria-label="Boost group"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.emoji} {g.name} — {g.contributed.toLocaleString()} / {g.goalPoints.toLocaleString()}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-3 gap-2">
          {[99, 90, 50].map((pct) => (
            <Button
              key={pct}
              variant="secondary"
              disabled={pending || !boosted}
              onClick={() =>
                boosted && run("boost", () => demoBoostGroup(boostGroup, boostTo(boosted, pct)))
              }
              className="px-0 py-3 text-[13.5px]"
            >
              {pct}%
            </Button>
          ))}
        </div>
        <input
          value={boostPoints}
          onChange={(e) => setBoostPoints(e.target.value)}
          inputMode="numeric"
          placeholder="Exact target, e.g. 4900"
          className={FIELD}
          aria-label="Exact target points"
        />
        <Button
          disabled={pending || !boostPoints}
          onClick={() => run("boost", () => demoBoostGroup(boostGroup, Number(boostPoints)))}
        >
          {busy === "boost" ? "Boosting…" : "Boost to exact target"}
        </Button>
        <p className="text-[13px] text-muted">
          {boosted
            ? `99% = ${boostTo(boosted, 99).toLocaleString()} · the ledger only moves forward, so a target below ${boosted.contributed.toLocaleString()} is refused.`
            : "No groups."}
        </p>
        {note("boost")}
      </Card>

      {/* ---- advance day — LAST in the runbook -------------------------------- */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className={MICRO}>Advance 1 day</p>
          <FastForward className="size-5 text-primary" />
        </div>
        <Button disabled={pending} onClick={() => run("day", demoAdvanceDay)}>
          {busy === "day" ? "Advancing…" : "Advance 1 day"}
        </Button>
        <p className="text-[13px] text-muted">
          Run this LAST. It regenerates everyone&apos;s savings, which can un-nudge your target and
          silently break the nudge beat. Safe to double-tap.
        </p>
        {note("day")}
      </Card>
    </>
  );
}
