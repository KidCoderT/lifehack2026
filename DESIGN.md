# Evergreen design spec — Field Notes

Light theme only. Mobile-first single column (`max-w-md`, set in `src/app/layout.tsx`).

**Field Notes is locked.** Tokens live in `src/app/globals.css` `@theme`; the reference
rendering of every screen is direction A in `styles.html`. `style.html` is the superseded
"Royal Field" mockup, kept only as the before-picture — do not take anything from it.

The idea in one line: **an app about measurement, set in the typeface of measurement.** Flat
vector, restrained sage, one monospace face, a lot of empty space around each object. It should
read as a precise instrument that happens to be beautiful, not as a game with a chart bolted on.

---

## The loop this UI has to sell

Save power → earn Fertilizer Points → your tree grows → you give points to your community's
garden → the group crosses a threshold → **everyone** gets the reward. The design's whole job
is to make each of those five arrows visible in under a second.

## Non-negotiables

1. **The tree is the hero.** Full-bleed on Home, top ~45% of the viewport, the largest element
   on the screen, above the wallet. Never a card in a scroll stack.
2. **The garden is an isometric plot, never a grid of boxes.** See [The plot](#the-plot).
3. **Every colour encodes state.** Growth, currency, over-baseline, alarm. If a colour is there
   because it looks nice, cut it. There is no decorative accent in this palette.
4. **Flat fills. No gradients, no drop shadows, anywhere.** Not on cards, not on tiles, not on
   the trees, not on buttons. Depth comes from the isometric projection and from value contrast.
   `--card-shadow` does not exist; if you reach for `shadow-*`, you are off-spec.
5. **No opacity ramps in artwork.** A lighter green is `canopy`, a darker one is `canopy-deep`.
   `fill-canopy/70` is not a colour, it is a smudge.
6. **Real SVG, never emoji as art.** The six growth stages live in `src/components/tree.tsx`.
   Emoji appears only where it is data from the database: `groups.emoji`, `vouchers.emoji`.
7. **One primary action per screen.** Home → *Feed your tree*. Garden → *Nudge \<name\>*.
   Energy → *Sync meter*. Rewards → *Contribute points*. Everything else is secondary or a link.

## Tokens

Defined in `src/app/globals.css` `@theme` — use the generated utilities (`bg-background`,
`fill-canopy`, `text-flag`, `stroke-bark`, …), never raw hex or `zinc-*`/`lime-*` defaults.

| Token | Value | Use |
|---|---|---|
| `background` | `#edefe6` | page ground |
| `surface` | `#f6f8f1` | cards, the plot's own surface, blossoms |
| `surface-muted` | `#e4e9dc` | bar tracks, secondary buttons, avatar fallback, icon chips |
| `border` | `#dce2d3` | card borders, dividers |
| `foreground` | `#2a3328` | body text |
| `muted` | `#5e6b5c` | micro-labels, captions, inactive nav, chart labels |
| `primary` | `#2f5a38` | CTAs, active nav, progress fill, under-baseline bars |
| `primary-foreground` | `#f6f8f1` | text on primary |
| `plot` | `#cbd9c0` | isometric tiles, the ground ellipse under the hero tree |
| `plot-edge` | `#b2c4a6` | tile hairline |
| `plot-hot` | `#e9a94b` | leaking tiles, over-baseline bars, streak |
| `canopy` | `#4c7a4e` | lit side of foliage |
| `canopy-deep` | `#2f5a38` | shadow side of foliage (same value as `primary`, different role) |
| `bark` | `#2a2620` | trunks and branches |
| `panel` | `#2a3328` | dark telemetry card |
| `panel-foreground` | `#edefe6` | text on `panel` |
| `flag` | `#b23a2b` | `N leaking`, over baseline, form errors |

There is deliberately **no** `accent`, `warn`, or `danger`. Amber is `plot-hot`, red is `flag`,
and there is no teal at all — the old `#0ea5b0` is gone. Water telemetry uses the same
primary/plot-hot pair as electricity; the metric is labelled, it does not need its own hue.

## Type

**JetBrains Mono is the only face.** `--font-sans` and `--font-mono` both resolve to it in
`@theme`, so `font-mono` and the default are the same thing. Loaded once in
`src/app/layout.tsx` at weights 400 / 500 / 700. There is no second family — that is the point
of the direction, not an omission.

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Hero number (`−18.6%`, `340 pts`) | 42px | 700 | `-0.02em` |
| Section heading / stage name | 26px | 700 | `-0.02em` |
| Body | 13px / 1.6 | 400 | normal |
| Row title | 13.5px | 600 | normal |
| Micro-label (uppercase) | 11.5px | 500 | `0.11em` |
| Nav label | 11px | 500 | normal |
| Form input | 16px | 400 | normal |

Form inputs sit at 16px against the 13px body on purpose: iOS Safari zooms the viewport on
focus for anything smaller, and the jump is worse than the size mismatch.

Rules: nothing below 11px, ever. The number that sells a screen is ≥ 36px — a screen whose
largest text is 14px has no hierarchy. Uppercase is reserved for micro-labels; everything else
is sentence case. Monospace is already tabular, so `font-variant-numeric` is unnecessary.

## Rhythm

- Screen padding `px-4`, 12px between stacked cards.
- Card: `rounded-2xl border border-border bg-surface p-5`. **No shadow.**
- Buttons: `rounded-xl`, 15px/700, full-width primary at the foot of its card.
- Inputs: `rounded-2xl border border-border bg-surface px-5 py-4`, focus `ring-2 ring-primary`.
- Bars: 8px track, fully rounded, `bg-surface-muted` track and `bg-primary` fill.
- Radii top out at `rounded-2xl` (16px). Field Notes is squarer than the old spec — `rounded-3xl`
  reads soft and undercuts the instrument feel.

## The plot

The community garden is a 5×5 diamond in isometric projection. Reference implementation:
`iso()` / `tilePts()` / `tile()` / `selRing()` / `tree()` in `styles.html`, ready to port.

- **Height is the ranking.** Each member's tree renders at its true stage, so a Blossoming tree
  visibly towers over a Seed. No numbers, no leaderboard row, no legend. This is the social
  pressure mechanic; a grid of equal cells destroys it.
- **Leaking tiles.** A member over baseline — or an open group waste alert — fills their tile
  `plot-hot` and increments an `N leaking` counter (in `flag`) in the plot header. Waste becomes
  a *place* on the map rather than an inbox item.
- **Empty plots are bare tiles**, no tree.
- **`tap a plot`** is the inspector affordance: 12.5px, `muted`, dotted underline, centred under
  the plot. Tapping opens the member card — avatar, username, stage name, points given to this
  group, and the nudge action.
- **Geometry.** Tile 44×22 (2:1 isometric), origin `(112, 74)`, viewBox `0 0 224 188`.
  `x = 112 + (c−r)·22`, `y = 74 + (c+r)·11`.
- **Paint order.** Tiles first (coplanar, any order) → trees back-to-front by depth `(c + r)` →
  the selected plot's ring **last**, above the trees. Ring the other way round and the tree
  standing on the tile hides the selection.
- **Tree scale, per stage 0–5** — tuned, not arbitrary. Larger values crowd the plot and swallow
  the leaking tiles: trunk height `[–, –, 13, 19, 25, 31]`, canopy radius `[–, –, 5, 6.6, 8.1,
  9.3]`, trunk width `[–, –, 1.7, 2.2, 2.7, 3.1]`. Stage 0 is a bare mound; stage 1 is a stem
  with two leaf ellipses; stage 5 adds three blossom dots in `surface`.

Alerts keep the header bell and its unread dot (`src/app/(authed)/layout.tsx` already computes
the count), but the plot is where waste actually gets noticed.

## Screens

| Screen | Top to bottom | Primary action |
|---|---|---|
| **Home** `/` | status + streak pill · tree hero with stage name and progress to next stage · fertilizer wallet · this week vs baseline · leaking-count callout | Feed your tree |
| **Garden** `/garden/[groupId]` | group name + `N leaking` · the plot + `tap a plot` · group goal bar · member inspector | Nudge `<username>` |
| **Energy** `/energy` | device + live pill · today vs baseline on the dark `panel` · 14-day bar chart with dashed baseline · electricity/water breakdown · conversion explainer | Sync meter |
| **Rewards** `/vouchers` | wallet · group goal with progress and shortfall · locked group quests · personal catalogue | Contribute points |

## Canonical values

Never invent these — they come from `src/lib/points.ts` and `scripts/seed.ts`.

- `STAGES = [0, 50, 150, 400, 800, 1500]`
- Stage names: Seed · Sprout · Sapling · Young Tree · Mature Tree · Blossoming
- `earnFor()`: **1% under baseline = 10 points**
- Groups: Solar Squad ☀️ goal 5000 (Universal Studios group discount) · Compost Crew 🍃 goal
  4000 (escape room night) · Tide Turners 🌊 goal 6000 (Sentosa beach day fund)
- Wallet = `sum(earn) − sum(contribute) − sum(redeem)`; leaderboard = `sum(earn)`;
  a group's tree and goal bar = `sum(contribute)` for that group

## Navigation

Five tabs, matching the shipped `src/components/nav/bottom-nav.tsx`:
**Home · Garden · Energy · Rewards · Profile**. Lucide icons at 21px, label 11px.

No "EcoVolt" tab — that is a hardware brand name, not something a user is looking for. EcoVolt
appears as the device identity *inside* the Energy screen (`EcoVolt EV-402 · live`).

## Copy voice

- Name things by what the user controls. "Feed your tree", not "Submit contribution".
- A button's verb survives into its result: *Contribute points* → *Contributed*.
- Say the number and what it means, not the mechanism. "1,150 points short. Nobody gets it
  alone." beats "Group milestone progress: 77%".
- Empty and failure states give direction, not mood. An empty garden says what to do next.
- Sentence case everywhere except tracked uppercase micro-labels.

## Components

- `ui/Button` — motion `whileTap={{ scale: 0.97 }}`, variants primary/secondary/ghost.
- `ui/Card` — `rounded-2xl border border-border bg-surface p-5`, no shadow.
- `ui/StatCard` — label + big value + caption + lucide icon.
- `ui/ProgressBar` — track `bg-surface-muted`, fill `bg-primary`, CSS width transition.
- `ui/Avatar` — image, or initial letter in `primary` on `bg-surface-muted`.
- `charts/BarChart` — server-rendered SVG, no chart lib. Days over baseline fill `plot-hot`,
  days under fill `primary`; the most recent day is full opacity, earlier days 75%. The baseline
  is a dashed `stroke-bark` line at full opacity — it crosses `primary`-filled bars, and anything
  lighter (`muted`, or `foreground` at 40%) disappears exactly where it has to be read.
- `Tree` — client leaf; 6 inline SVG stages, flat `canopy` / `canopy-deep` / `bark` fills,
  crossfade + scale via `AnimatePresence`. Blossoms are `surface`.
- `nav/BottomNav` — the five tabs above.
- **Missing, to build in Phase 2:** `garden/Plot` — the isometric 5×5. Client leaf; it handles
  taps.

## Animation rules

- Pages stay async server components; `motion` only inside small `"use client"` leaves.
- One `FadeIn` entrance per section, no stagger cascades, no page-transition system.
- Tap feedback on every button. Progress bars animate width. Tree stage changes crossfade.
- `prefers-reduced-motion` is honoured globally in `globals.css`; do not re-implement it
  per component.

## Accessibility floor

Body text ≥ 4.5:1 against its ground, large text ≥ 3:1 — and micro-labels count as body, since
11.5px is not large text. Visible keyboard focus on every interactive element. The plot carries
an `aria-label` naming the group; individual plots are buttons labelled with the member's name
and stage.

Measured for this palette: `muted` on `background` **4.85**, `muted` on `surface` **5.25**,
`primary-foreground` on `primary` **7.43**, `flag` on `surface` **5.55**. All clear. `muted`
started at `#6e7c6b` and failed at 4.12 — it was darkened to `#5e6b5c`. Re-measure before
changing any of these five values.

## Icons

`lucide-react` everywhere. Emoji only when it is data from the DB (`groups.emoji`,
`vouchers.emoji`).
