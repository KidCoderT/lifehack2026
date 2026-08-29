"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion } from "motion/react";
import { Leaf, Search } from "lucide-react";
import { sendNudge } from "@/app/(authed)/garden/actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { STAGE_NAMES } from "@/lib/points";
import { overAria, overPill, overSentence } from "./over-usual";

export type PlotMember = {
  id: string;
  username: string;
  avatarUrl: string | null;
  contributed: number;
  stage: number;
  /** Earned no points on the latest reading day — the amber tile. */
  leaking: boolean;
  /** Percent above baseline that day. Can be <= 0: see over-usual.ts. */
  overPct: number | null;
  isMe: boolean;
};

/* ── Geometry — DESIGN.md "The plot". Tile 44×22 (2:1), origin (112,74). ───────── */
const TW = 44;
const TH = 22;
const OX = 112;
const OY = 74;
const SLOTS = 25;

const iso = (c: number, r: number): [number, number] => [
  OX + ((c - r) * TW) / 2,
  OY + ((c + r) * TH) / 2,
];

function tilePts(c: number, r: number) {
  const [x, y] = iso(c, r);
  return `${x},${y - TH / 2} ${x + TW / 2},${y} ${x},${y + TH / 2} ${x - TW / 2},${y}`;
}

/* Six growth stages, matching STAGES [0,50,150,400,800,1500]. Flat fills, no opacity. */
const TRUNK_H = [0, 0, 13, 19, 25, 31];
const CANOPY_R = [0, 0, 5, 6.6, 8.1, 9.3];
const TRUNK_W = [0, 0, 1.7, 2.2, 2.7, 3.1];

function TreeArt({ c, r, s }: { c: number; r: number; s: number }) {
  const [x, y] = iso(c, r);

  if (s === 0)
    return (
      <ellipse cx={x} cy={y - 1.5} rx={4.2} ry={2.4} className="fill-bark" />
    );

  if (s === 1) {
    return (
      <g>
        <rect
          x={x - 0.9}
          y={y - 9}
          width={1.7}
          height={9}
          className="fill-bark"
        />
        <ellipse
          cx={x - 3.6}
          cy={y - 8}
          rx={3.6}
          ry={2.3}
          transform={`rotate(-24 ${x - 3.6} ${y - 8})`}
          className="fill-canopy"
        />
        <ellipse
          cx={x + 3.6}
          cy={y - 10}
          rx={3.6}
          ry={2.3}
          transform={`rotate(22 ${x + 3.6} ${y - 10})`}
          className="fill-canopy-deep"
        />
      </g>
    );
  }

  const h = TRUNK_H[s];
  const rad = CANOPY_R[s];
  const w = TRUNK_W[s];
  const t = y - h;

  return (
    <g>
      <rect
        x={x - w / 2}
        y={t}
        width={w}
        height={h + 1}
        rx={w / 2}
        className="fill-bark"
      />
      <circle
        cx={x - rad * 0.64}
        cy={t + rad * 0.38}
        r={rad * 0.74}
        className="fill-canopy-deep"
      />
      <circle
        cx={x + rad * 0.64}
        cy={t + rad * 0.32}
        r={rad * 0.7}
        className="fill-canopy-deep"
      />
      <circle cx={x} cy={t - rad * 0.22} r={rad} className="fill-canopy" />
      {s === 5 && (
        <>
          <circle
            cx={x - rad * 0.45}
            cy={t - rad * 0.5}
            r={1.9}
            className="fill-surface"
          />
          <circle
            cx={x + rad * 0.5}
            cy={t - rad * 0.1}
            r={1.7}
            className="fill-surface"
          />
          <circle
            cx={x + rad * 0.05}
            cy={t + rad * 0.55}
            r={1.6}
            className="fill-surface"
          />
        </>
      )}
    </g>
  );
}

/* Rings paint last so the tree standing on the tile never hides the selection. */
function Ring({ c, r, pin }: { c: number; r: number; pin: boolean }) {
  const [x, y] = iso(c, r);
  return (
    <g>
      <polygon
        points={tilePts(c, r)}
        fill="none"
        strokeWidth={4}
        className="stroke-surface"
      />
      <polygon
        points={tilePts(c, r)}
        fill="none"
        strokeWidth={2}
        className="stroke-foreground"
      />
      {pin && (
        <>
          <circle cx={x} cy={y - 46} r={3.4} className="fill-foreground" />
          <path
            d={`M${x} ${y - 42} v6`}
            strokeWidth={2}
            className="stroke-foreground"
          />
        </>
      )}
    </g>
  );
}

/**
 * "This one is yours" is carried by the TILE, not by a floating marker — a pin above the
 * canopy read as clutter. `plot-edge` is the tile hairline colour, so a tile filled with
 * it is visibly a shade deeper than its neighbours without introducing a new colour.
 *
 * Over-baseline still wins the fill, because amber is the alarm channel and must never
 * be overridden by an identity cue. Your tile therefore also carries a `primary` outline,
 * which is what identifies you on the day you are the one leaking.
 */
function tileFill(m: PlotMember | undefined) {
  if (!m) return "fill-plot";
  if (m.leaking) return "fill-plot-hot";
  return m.isMe ? "fill-plot-edge" : "fill-plot";
}

export function Plot({
  members,
  groupId,
  groupName,
}: {
  members: PlotMember[];
  groupId: number;
  groupName: string;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [nudged, setNudged] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const plotRef = useRef<SVGSVGElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);

  // Tapping anywhere that is not the plot or the open inspector clears the selection.
  // The inspector is excluded deliberately: Nudge lives inside it, and deselecting on
  // pointerdown would unmount that button before its click ever landed. Taps inside the
  // plot are left to the tiles and the bare-ground rect, which know what was hit.
  useEffect(() => {
    if (sel === null) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (plotRef.current?.contains(t) || inspectorRef.current?.contains(t))
        return;
      setSel(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [sel]);

  // Stable plot order is decided server-side (sorted by user_id); slots beyond the
  // member list are bare tiles.
  const shown = members.slice(0, SLOTS);
  const overflow = members.length - shown.length;

  const q = query.trim().toLowerCase();
  const hits = q
    ? shown.flatMap((m, i) => (m.username.toLowerCase().includes(q) ? [i] : []))
    : [];

  function search(value: string) {
    setQuery(value);
    // Narrowing to one member opens their card; a broader search only rings the
    // matches (see `hits`) and never closes a card the user tapped open.
    const v = value.trim().toLowerCase();
    const found = v
      ? shown.flatMap((m, i) =>
          m.username.toLowerCase().includes(v) ? [i] : [],
        )
      : [];
    if (found.length === 1) setSel(found[0]);
  }

  const selected = sel === null ? null : shown[sel];

  const depthOrder = shown
    .map((m, i) => ({ i, depth: (i % 5) + Math.floor(i / 5), stage: m.stage }))
    .sort((a, b) => a.depth - b.depth);

  // SVG has no z-index — paint order IS the stacking order, so "bring to front" means
  // "render last". Array.prototype.sort is stable, so depth order survives underneath.
  // Keys stay tied to the slot, so React moves the existing node rather than remounting
  // it: the motion instance survives the reorder and the scale animates both ways.
  const treeOrder = [...depthOrder].sort(
    (a, b) => Number(a.i === sel) - Number(b.i === sel),
  );

  return (
    <>
      <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <Search className="size-4 shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Find a member"
          aria-label="Find a member by username"
          className="w-full bg-transparent text-base outline-none placeholder:text-muted"
        />
      </label>

      <Card className="flex flex-col items-center gap-1 p-2.5">
        {/*
          viewBox is cropped, not the geometry — DESIGN.md's tile 44×22 / origin (112,74)
          is untouched, this only trims dead sky. Drawn content runs y≈20 (the me-marker
          leaf, y−52 above the top tile, plus its halo) to y=173 (bottom tile vertex), so
          14→180 keeps clearance at both ends and drops ~22px of height on a phone.

          max-h is the belt: on a 390px column the plot was 265px tall inside a 1343px
          page, so it alone owned more than half of what a phone can show and pushed the
          inspector — where the Nudge action lives — off the fold. dvh, not vh, because
          mobile browser chrome makes vh lie.
        */}
        <svg
          ref={plotRef}
          viewBox="0 14 224 166"
          role="group"
          aria-label={`${groupName} garden: ${shown.length} plots, each tree at its growth stage`}
          className="mx-auto max-h-[30dvh] w-full"
        >
          {/* Bare ground behind everything: the margin around the diamond is still "somewhere
              else", so tapping it clears the ring. fill="transparent" hit-tests; fill="none"
              would not. First child, so every tile and tree sits above it. */}
          <rect
            x={0}
            y={14}
            width={224}
            height={166}
            fill="transparent"
            aria-hidden
            onClick={() => setSel(null)}
          />

          {/* tiles — coplanar, any order; these are the tap targets */}
          {Array.from({ length: SLOTS }, (_, i) => {
            const c = i % 5;
            const r = Math.floor(i / 5);
            const m = shown[i];
            return (
              <polygon
                key={i}
                points={tilePts(c, r)}
                strokeWidth={m?.isMe ? 1.75 : 1}
                className={`${m?.isMe ? "stroke-primary" : "stroke-plot-edge"} ${tileFill(m)} ${
                  m ? "cursor-pointer" : ""
                }`}
                role={m ? "button" : undefined}
                tabIndex={m ? 0 : undefined}
                aria-current={m && sel === i ? "true" : undefined}
                aria-hidden={m ? undefined : true}
                aria-label={
                  m
                    ? `${m.username}${m.isMe ? ", your plot" : ""}, ${STAGE_NAMES[m.stage]}` +
                      overAria(m.leaking, m.overPct)
                    : undefined
                }
                // An empty tile is "somewhere else" — tapping bare ground clears the ring.
                onClick={m ? () => setSel(i) : () => setSel(null)}
                onFocus={m ? () => setSel(i) : undefined}
                onKeyDown={
                  m
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSel(i);
                        }
                      }
                    : undefined
                }
              />
            );
          })}

          {/* trees — back to front by depth (c + r); never steal a tap from their tile */}
          <g pointerEvents="none">
            {treeOrder.map(({ i, stage }) => {
              const [tx, ty] = iso(i % 5, Math.floor(i / 5));
              return (
                <motion.g
                  key={i}
                  animate={{ scale: i === sel ? 1.1 : 1 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  // Grow from the trunk's base, not the art's centre, or the tree lifts
                  // off its tile. transformBox view-box makes the origin viewBox units.
                  style={{
                    transformOrigin: `${tx}px ${ty}px`,
                    transformBox: "view-box",
                  }}
                >
                  <TreeArt c={i % 5} r={Math.floor(i / 5)} s={stage} />
                </motion.g>
              );
            })}
          </g>

          {/* rings last, above the trees */}
          <g pointerEvents="none">
            {hits
              .filter((i) => i !== sel)
              .map((i) => (
                <Ring
                  key={`hit-${i}`}
                  c={i % 5}
                  r={Math.floor(i / 5)}
                  pin={false}
                />
              ))}
            {sel !== null && <Ring c={sel % 5} r={Math.floor(sel / 5)} pin />}
          </g>
        </svg>

        <span className="text-[12.5px] text-muted underline decoration-dotted underline-offset-4">
          tap a plot
        </span>
      </Card>

      {overflow > 0 && (
        <p className="text-center text-xs text-muted">
          +{overflow} more {overflow === 1 ? "member" : "members"} growing
          outside the plot
        </p>
      )}
      {q && hits.length === 0 && (
        <p className="text-center text-xs text-muted">
          Nobody here goes by “{query.trim()}”.
        </p>
      )}

      {/* Wrapper only exists to carry the ref — ui/Card takes no ref, and reaching into
          shared UI for one local need is not worth it. */}
      <div ref={inspectorRef}>
        {selected ? (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar
                  url={selected.avatarUrl}
                  name={selected.username}
                  className="size-10"
                />
                <div>
                  <p className="text-[13.5px] font-semibold">
                    {selected.username}
                    {selected.isMe && " (you)"}
                  </p>
                  <p className="text-xs text-muted">
                    {STAGE_NAMES[selected.stage]} ·{" "}
                    {selected.contributed.toLocaleString()} pts given
                  </p>
                </div>
              </div>
              {selected.leaking && (
                <span className="shrink-0 rounded-xl bg-plot-hot px-2.5 py-1 text-[11.5px] font-medium text-foreground">
                  {overPill(selected.overPct)}
                </span>
              )}
            </div>

            {selected.leaking && (
              <p className="mt-3 text-[13px] text-muted">
                {overSentence(selected.overPct, selected.isMe)}
              </p>
            )}

            {!selected.isMe && (
              <Button
                className="mt-3 w-full"
                disabled={pending || nudged.includes(selected.id)}
                onClick={() => {
                  const target = selected.id;
                  setError(null);
                  setNudged((n) => [...n, target]); // optimistic; see sendNudge's ponytail note
                  startTransition(async () => {
                    const res = await sendNudge(target, groupId);
                    if (!res.ok) {
                      setNudged((n) => n.filter((id) => id !== target));
                      setError(res.error ?? "That leaf didn't land.");
                    }
                  });
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  <Leaf className="size-4" />
                  {nudged.includes(selected.id)
                    ? "Leaf sent"
                    : `Nudge ${selected.username}`}
                </span>
              </Button>
            )}
            {error && <p className="mt-2 text-xs text-flag">{error}</p>}
          </Card>
        ) : (
          <Card className="text-[13px] text-muted">
            Tap a plot to see who is growing there — and send them a leaf.
          </Card>
        )}
      </div>
    </>
  );
}
