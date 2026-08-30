# Evergreen — Implementation Plan

Task-level breakdown and live progress report for Evergreen. Work top to bottom; each phase ends with a runnable check. Don't start phase N+1 until phase N's "done when" passes. Keep this file updated: check boxes off, add discovered tasks under the phase they belong to.

> **One exception to "top to bottom": [Phase 6](#phase-6--game-feel--polish) runs *alongside*
> Phase 5, not after it.** It is numbered last but blocked by nothing in Phase 5 except one
> explicitly-deferred item. The two touch disjoint files — the demo rig is `app/(authed)/demo/**`,
> Phase 6 is `components/**`.

---

## Core User Flow (must not regress)

This is the product's baseline loop — every phase builds on top of it and must remain functional without regressions.

1. **Login & Session Gate.** `src/app/login/page.tsx` takes org-issued email (`tejas.sunil@u.nus.edu`) + password (`12345678`), authenticates via `supabase.auth.signInWithPassword`, sets the cookie session via `@supabase/ssr`, and navigates to `/`. `requireProfile()` in `src/lib/supabase/server.ts` intercepts all authed pages: redirects unauthenticated users to `/login`, and redirects users without a `username` to `/onboarding`.
2. **Onboarding Profile Setup.** `src/app/onboarding/page.tsx` allows the user to set a public username (3–20 characters) and upload an avatar photo (client canvas resamples to 256×256 JPEG to normalise large phone photos, uploaded to Supabase `avatars` storage bucket). Groups are pre-assigned by the organization in `group_memberships` (seeded), never user-selected.
   - **Only pre-seeded accounts can complete onboarding.** There is no `handle_new_user` trigger and no `insert` grant on `profiles`, so a fresh signup has no profile row to update and hits `"No profile row for this account"`. Accepted for the hackathon — but do not invite judges to register their own account.
   - **Canvas cannot decode HEIC** outside Safari. iPhone photos shared as HEIC will fail the re-encode in Chrome/Firefox; the form must surface a readable error rather than a silent failure.
3. **Dashboard Command Center.** `src/app/(authed)/page.tsx` renders user wallet balance ($\sum \text{earn} - \sum \text{contribute} - \sum \text{redeem}$), multi-group mini-trees for every assigned community, 7-day energy savings trend SVG chart, monthly contribution stats, and global leaderboard with personal rank highlighted.
4. **Community Garden 5×5 Matrix.** `/garden/[groupId]` displays the community quest progress bar, a 5×5 interactive grid with each member's tree rendered at their exact growth stage ($0 - 5$), username search to highlight specific plots, a tree inspector card showing member stats, and a one-tap leaf nudge button for peers with zero savings yesterday.
5. **EcoVolt Energy & Water Tracker.** `/energy` displays 14-day energy consumption vs the frozen per-user baseline, calculates percentage savings ($1\% = 10\text{ pts}$), breaks down daily point conversion, and displays water conservation telemetry.
6. **Rewards & Communal Quests.** `/vouchers` enables redeeming personal vouchers (mints an 8-character code and deducts points from wallet) and contributing points to an assigned community. Once group contributions reach the goal threshold (e.g. 5,000 pts for Solar Squad), the group voucher (e.g. Universal Studios passes) unlocks for all members.
7. **Social Alerts & Accountability.** `/alerts` displays community energy waste notices (e.g. "Lights left on in Common Room") with "Mark Fixed" and "Report" actions, along with peer leaf nudges. Unread count appears as a badge on the header bell icon.
8. **Demo Rig Time-Travel.** `/demo` (hidden control room) allows advancing time by 1 day (generating EcoVolt readings and awarding points), triggering waste alerts, and simulating peer slacking for live pitch demonstration.

---

## API & Data Action Surface (target, all phases)

Server Actions are named in **camelCase** here and everywhere else in this document — the table and
the phase bodies must always agree. Every action listed in a phase body must appear here, and vice
versa.

| Route / Action | Phase | Method / Type | What |
|---|---|---|---|
| `/login` | 0 | Client Form | Email + password auth via `signInWithPassword` |
| `/onboarding` | 0 | Client Form + Storage | Avatar upload to `avatars` bucket + username update |
| `/` (Dashboard) | 1 | Server Component | Wallet balance, mini-trees, 7-day chart, global leaderboard |
| `/garden` | 2 | Server Component | Redirects to the user's default group (see Phase 2) |
| `/garden/[groupId]` | 2 | Server Component | 5×5 matrix, quest progress bar, tree inspector popover |
| `sendNudge` | 2 | Server Action | Insert `events` row (`kind='nudge'`, `from_user`, `to_user`) |
| `/energy` | 3 | Server Component | 14-day EcoVolt energy/water charts, savings-to-points engine |
| `/vouchers` | 4 | Server Component | Personal catalog, group quest status, redemption history |
| `contributePoints` | 4 | Server Action | Insert `ledger` (`kind='contribute'`, `group_id`, `points`) |
| `redeemVoucher` | 4 | Server Action | Insert `ledger` (`kind='redeem'`) + mint `redemptions` code |
| `/alerts` | 4.5 | Server Component | In-app alerts & nudges inbox |
| `resolveAlert` | 4.5 | Server Action → RPC | Calls `resolve_alert(event_id, action, photo_url)`; sets `events.status` / `photo_url` / `resolved_by` **and mints the earn points** |
| `resolve_alert` | 4.5 | Postgres fn (**security definer**) | The only sanctioned path that mints `earn`. Claims the alert atomically and pays 100 / 50 / 10. **Revised in Phase 5 planning:** a `fixed` claim must also match a `reported` row — see Phase 4.5 revision |
| `dismissNudge` | 4.5 | Server Action | Update a nudge's `events.status` $\rightarrow$ `fixed` (= acknowledged) |
| `/profile` | 4.5 | Server Component | Profile overview, avatar update |
| `signOut` | 4.5 | Server Action | `supabase.auth.signOut()` + redirect to `/login` |
| `/demo` | 5 | Server + Actions | Advance day, trigger waste alert, zero user savings, boost group |
| `demoAdvanceDay` | 5 | Server Action (**admin**) | Generate next day's readings + `earn` ledger rows for all users |
| `demoTriggerWasteAlert` | 5 | Server Action (**admin**) | Insert an open `kind='alert'` row for **any group, any location** (parameterised) |
| `demoZeroUserSavings` | 5 | Server Action (**admin**) | Zero a target user's latest reading so they become nudgeable |
| `demoBoostGroup` | 5 | Server Action (**admin**) | Push a group's contributions to **a target you set** (presets 99/90/50% or exact points) — this is what arms the unlock celebration |
| `demoResetSeed` | 5 | Server Action (**admin**) | Re-run the deterministic seed for a clean repeat *(cuttable)* |

Actions marked **admin** must use `createAdminClient()` — RLS blocks them for normal clients by
design. See Standing Rule 4.

---

## Phase 0 — Skeleton & Data Foundation

Goal: Running Next.js 16 app with Supabase auth, seeded database, light-theme design tokens, and core UI kit.

### Database & Auth
- [x] `supabase/schema.sql` — Idempotent DDL with 8 tables: `groups`, `profiles`, `group_memberships`, `readings`, `ledger`, `vouchers`, `redemptions`, `events`.
- [x] Row Level Security (RLS) enabled on all 8 tables with explicit authenticated policies.
- [x] Storage bucket `avatars` configured with RLS allowing authenticated users to upload to their own user folder.
- [x] `src/lib/supabase/client.ts` & `src/lib/supabase/server.ts` — SSR Supabase client wrappers with cookie persistence and `requireProfile()` auth gate.
- [x] `src/lib/supabase/admin.ts` — Service-role admin client for seeding and background tasks.
- [x] `src/proxy.ts` — Next 16's middleware equivalent (the `middleware.ts` rename). Refreshes the Supabase session cookie on every request and redirects anonymous traffic to `/login`. **Load-bearing for the entire auth story** — `requireProfile()` alone does not cover it.
- [x] `scripts/seed.ts` — Mulberry32 deterministic PRNG seeding 22 users (including `tejas.sunil@u.nus.edu`), 3 groups (Solar Squad, Compost Crew, Tide Turners), 21 days of EcoVolt energy/water readings, ledger earn/contribution transactions, and sample alerts. Demo-stage tuning lives in the constants at the top (`DEMO_GROUP_SIZE`, `DEMO_GROUP_FILL`, `DEMO_WALLET_RESERVE`); the printed summary reports the pitch's unlock gap and asserts the demo wallet covers it.
- [x] `src/lib/points.ts` — Core points math: `earnFor(baseline, actual)` ($1\% = 10\text{ pts}$), `treeStage(contributed)` (0–5), `STAGES` $[0, 50, 150, 400, 800, 1500]$, and date helpers.
- [x] **Apply `supabase/schema.sql` to the live Supabase project.** Applied 2026-08-29. The file is idempotent, so re-running is safe. **This must happen before every fresh seed.** Two ways to run it:
  - `bun run db:push` — needs `SUPABASE_DB_URL` in `.env.local` (see `.env.local.example`). Point it at the **pooler on port 6543**; port 5432 is firewalled on the NUS network, which is also why `supabase db query --linked` hangs at `Initialising login role...`.
  - Or paste the file into the Supabase SQL editor. Required for the `storage.objects` policies if the pooler role isn't their owner.

### Frontend Shell & UI Kit
- [x] Next.js 16 + React 19 + Tailwind CSS v4 + TypeScript strict setup.
- [x] `src/app/globals.css` — `@theme` block defining the locked **Field Notes** tokens (`background #edefe6`, `surface #f6f8f1`, `primary #2f5a38`, `plot #cbd9c0`, `plot-hot #e9a94b`, `canopy #4c7a4e`, `bark #2a2620`, `panel #2a3328`, `flag #b23a2b`). JetBrains Mono is the only typeface; there is no `accent`/`warn`/`danger`. See `DESIGN.md`.
- [x] `src/app/layout.tsx` — Mobile-first viewport container (`mx-auto flex min-h-full w-full max-w-md flex-col` on `body`, with `h-full` on `html`).
- [x] `src/app/(authed)/layout.tsx` — Sticky header with unread alert dot and bottom navigation bar.
- [x] `src/components/ui/` — `Button` (with tap feedback), `Card`, `StatCard`, `ProgressBar`, `Avatar`.
- [x] `src/components/tree.tsx` — Client leaf rendering 6 custom SVG tree stages with `AnimatePresence` crossfade.
- [x] `src/components/charts/bar-chart.tsx` — Server-rendered bar chart with dashed baseline. **CSS, not SVG** — see the Phase 1 mobile note; do not rebuild it as a stretched `<svg>`.
- [x] `src/components/nav/bottom-nav.tsx` — 5-tab mobile navigation bar (Home, Garden, Energy, Rewards, Profile).
- [x] `/login` (`src/app/login/page.tsx`) & `/onboarding` (`src/app/onboarding/page.tsx` + `form.tsx` with canvas JPEG conversion).

**Done when:** `supabase/schema.sql` has been applied to the live project; `bun run seed` populates Supabase and prints `Pitch unlock beat: … YES`; logging in with `tejas.sunil@u.nus.edu` / `12345678` navigates through onboarding to a rendered dashboard at `/`.

**Status: complete (2026-08-29).** Both blockers cleared:
- Schema applied; `bun run seed` prints `Pitch unlock beat: contribute 249 pts to Solar Squad -- wallet covers it: YES`.
  Demo user: earned 2330, wallet 1282. Solar Squad 4751/5000 (20 members), Compost Crew 2026/4000, Tide Turners 3807/6000.
- `src/app/(authed)/page.tsx` now exists so the post-login `router.replace("/")` lands. It is a
  **placeholder**: wallet card + one mini-tree per community only. The 7-day chart, monthly stat
  cards and leaderboard are still Phase 1's checklist below, unticked.

Known gaps carried into later phases:
- Every seeded account already has a `username`, so the demo user skips `/onboarding` and goes
  straight to `/`. To exercise the onboarding path, null that user's `username` first.
- The other four nav tabs (`/garden`, `/energy`, `/vouchers`, `/profile`) and the header bell
  (`/alerts`) 404 until Phases 2–4.5 land.
- The mini-tree stage on `/` is the **user's own** contribution to that group, not the group total:
  `STAGES` caps at 1500 while every `goal_points` is 4000+, so a group-total tree would read
  Blossoming permanently. The goal progress bar is still the group total, per AGENTS.md.

Everything else in this phase's checklist is verified against the working tree.

---

## Phase 1 — Dashboard Command Center

Goal: Logged-in user sees live wallet balance, assigned community trees, 7-day earning trend, monthly impact, and global ranking.

### Backend & Data Queries
- [x] Implement dashboard data aggregation in `src/app/(authed)/page.tsx`:
  - Calculate user wallet balance: `sum(earn) - sum(contribute) - sum(redeem)` from `ledger`.
  - Fetch assigned groups from `group_memberships` with per-group contribution totals and tree stages.
  - Fetch last 7 days of energy readings for the user with calculated baseline and points earned.
  - Calculate weekly improvement percentage vs prior 7 days.
  - Query all-time global leaderboard (`sum(points)` where `kind='earn'`) joined with `profiles`, computing current user's national rank.

### Frontend Components
- [x] Top Wallet Card: prominent points balance, "+ Earned this week" tag, and quick-action shortcuts.
- [x] "My Community Trees" carousel/grid: displays one mini-tree per assigned group with group emoji, name, contributed points, stage badge, and direct link to `/garden/[groupId]`.
- [x] 7-Day Energy Impact Chart: integrates `BarChart` showing daily kWh vs baseline and daily points earned.
- [x] Monthly Contribution Stat Cards: Total kWh saved, Water saved (L), CO2 offset (kg), and Trees tended.
- [x] Global Leaderboard preview: Top 5 users with medals/badges, plus fixed row for current user with rank #.

**Done when:** for the seeded demo user, the wallet figure on `/` equals a hand-computed
$\sum \text{earn} - \sum \text{contribute} - \sum \text{redeem}$ from the `ledger` table; each
mini-tree's stage matches `treeStage()` applied to that group's contribution total; and the
leaderboard rank matches an `order by sum(points) desc` over `kind='earn'`. Deploy to Vercel and
confirm the same three numbers on the deployed URL.

**Status: built and verified locally (2026-08-29); Vercel deploy still outstanding.**
Verified by rendering `/` through the dev server with a real `@supabase/ssr` cookie (same RLS path
as production), then diffing against an independent query script: wallet **1,282**, +760 earned this
week, Solar Squad 4,751/5,000, Compost Crew 2,026/4,000, rank **#1 of 19**, streak 21d.

Two open decisions, both deliberate deviations rather than bugs:
- **Mini-tree stage is the user's own giving, not the group total** — contradicts this section's
  literal "Done when" text above. `STAGES` caps at 1,500 while every `goal_points` is 4,000+, so a
  group-total tree is permanently stage 5 and conveys nothing. The group total still drives the
  goal bar. Either accept this or raise `STAGES`; don't "fix" it back.
- **DESIGN.md and this checklist disagree on the Home screen.** DESIGN wants a full-bleed hero tree
  at ~45% viewport above the wallet plus a leaking-count callout; this checklist has neither and
  puts the wallet first. The checklist was followed. Decide which doc wins before Phase 5 polish.

**Revised 2026-08-30 — `BarChart` rebuilt in CSS.** The 7-day chart was an SVG with
`viewBox="0 0 168 105"` stretched by `w-full` to ~316px on a phone, scaling everything inside
**1.88×**: `fontSize={8}` painted at ~15px against a type scale whose micro-label is 11.5px, and the
factor moved with the container so no fixed size could ever be right. It is now flex/CSS — bars flex,
text is text. Measured on a 390px column: the chart block went 198px → 112px and its labels are a
true 11px. The rewrite also removed an `opacity-75` on earlier bars, which broke DESIGN.md's "no
opacity ramps" rule. **Any chart whose text lives inside a `w-full` SVG has this bug** — relevant to
Phase 3's `/energy` charts, which use the same component.

---

## Phase 2 — Community Garden & 5×5 Matrix

Goal: Interactive communal garden showing all group members' trees on a 5×5 plot with search, inspection, and peer nudging.

### Backend & Data Actions
- [x] Dynamic route `/garden/[groupId]`, plus `/garden` which redirects to the user's **default group**. There is no "primary group" concept in `group_memberships` (composite PK, no ordering column), so **define the default as the lowest `group_id` the user belongs to** — deterministic, no schema change. `requireProfile()` already returns the full `groups` array; pick from it, don't re-query. Note `params` is a Promise in Next 16 — `const { groupId } = await params`.
- [x] Fetch all group members, their profiles, and total points contributed to this specific group.
- [x] Group goal progress query: calculate $\sum \text{contributions}$ vs `groups.goal_points` and percentage.
- [x] Server Action `sendNudge(targetUserId, groupId)`: inserts `events` record (`kind='nudge'`). **De-duplication is best-effort only** — `events` has no `day` column and no unique index, so a same-day repeat check is an app-side `created_at::date` query and is racy under double-taps. Disable the button optimistically after the first tap; do not claim the constraint is enforced. Hardening it means a unique index on `(from_user, to_user, kind, (created_at::date))`.

### Frontend Components
- [x] Garden Top Header: Group selector dropdown (for multi-group users), total group tree canopy summary, and communal goal progress bar.
- [x] Isometric 5×5 Plot (`src/components/garden/plot.tsx`, client leaf) — **not** a grid of boxes:
  - 25 tiles in 2:1 isometric projection, each member’s tree at its true stage ($0 - 5$), so height alone conveys rank. Geometry, paint order and tuned tree scale are in `DESIGN.md`; reference implementation is `tile()` / `tree()` / `selRing()` in `styles.html`.
  - Members over baseline fill their tile `plot-hot` and increment a counter in the plot header. ~~`N leaking`~~ → the header now reads **`N not earning`** and the word "leaking" is retired from the UI; see the 2026-08-29 revision below for why an aggregate cannot claim everyone is over baseline.
  - **Plot order must be stable.** No table stores a plot/slot position, so derive it — **sort members by `user_id`** and fill the grid in that order. Sorting by contributions would make plots jump every time anyone contributes, including live on stage.
  - ~~Username label and contribution badge under each tree.~~ **Dropped deliberately — this
    contradicts DESIGN.md's locked plot rule ("Height is the ranking… No numbers, no leaderboard
    row, no legend").** Username, stage name and points-given live in the inspector and in each
    plot's `aria-label` instead. If you want the labels back, change DESIGN.md first.
  - Empty plots rendered as bare tiles, no tree. `tap a plot` is the inspector affordance. The demo group seeds 20 members (`DEMO_GROUP_SIZE`), so expect 5 bare tiles, not 17.
  - **Groups may exceed 25 members** — nothing in the schema caps them. Render the first 25 by the sort order above and show a "+N more" affordance rather than overflowing the grid.
- [x] Live Member Search: Instant filter input to find a member by username and highlight/zoom to their tree.
- [x] Tree Inspector Drawer / Modal: Clicking any tree opens member card with avatar, username, stage name, points contributed, and "Send Leaf Nudge" button.
- [x] Slacker Detection: Peer highlight indicator if a user logged zero savings yesterday.

**Done when:** Tapping any tree opens member inspector; search instantly highlights plots; sending a nudge creates an event in the database and provides visual feedback.

**Status: built and verified (2026-08-29), including in a real browser.**
- `/garden` → 307 → `/garden/1` (lowest group id). `/garden/3` (not a member) → 404.
- Solar Squad renders 25 tiles / 20 trees / **5 bare plots**, 4 tiles `plot-hot` with a matching
  `4 leaking` header count, goal `4,751 / 5,000`, `249 points short`.
- **Tap → inspector confirmed in Chrome**: selecting grace.ho's plot moved the selection ring and
  swapped the inspector to `Young Tree · 494 pts given`. **Search confirmed**: typing `liang.zw`
  pins and rings that plot and fills the inspector. Each tile is a real `button` with an
  `aria-label` like `"ben.lim, Seed, leaking"`.
- `sendNudge` was verified by a live insert through the `send nudge` RLS policy (`events.id = 3`).
  **That row cannot be deleted** — there is no `delete` grant on `events` — so the demo user has one
  pre-existing sent nudge. Every nudge you fire while testing is permanent; budget for that on stage.
- **Nudge de-duplication is optimistic client-side only** and is racy under double-taps. It is not
  and cannot be enforced without a unique index on `(from_user, to_user, kind, (created_at::date))`,
  which would be a schema change. Do not describe it as guaranteed.
- Group selector is a row of `<Link>` pills, not a dropdown — no JS, same job.

**Revised 2026-08-29 (later same day).** The verification record above is left as written — it was
true when made — but three things changed after it. Re-verified in Chrome against the same seed:
- **The goal is now a banner at the top of the screen**, above the search input, with per-goal
  artwork and the shortfall as a 36px hero number (`249` / `points short`). It is no longer passed
  to `<Plot>` as `children`; that prop is gone. New: `garden/goal-banner.tsx`, `garden/goal-art.tsx`.
- **"Leaking" is retired from the UI.** Header reads `4 not earning`; the inspector reads
  `Using 5% more power than usual today.` with a `+5% vs usual` pill; aria-labels read
  `ben.lim, Seed, using 5% more power than usual`. Percentages verified against the DB for
  day 2026-08-28: ben.lim +4.9→5, chloe.ng +5.9→6, daniel.koh +3.8→4, noah.p +1.1→1.
  The header deliberately does **not** say "over their usual": the predicate is `earnFor() === 0`,
  which fires from ~0.5% *under* baseline up, so an aggregate cannot claim everyone is over.
  Per-member copy branches on that in `garden/over-usual.ts`, which has a test beside it
  (`bun src/components/garden/over-usual.test.ts`). The `overPct === 0` branch has **no live
  seeded case** — it is covered by that test only, not by anything in the browser.
- ~~**Your own plot carries a permanent hollow leaf marker.**~~ **Superseded — see the 2026-08-30
  revision below. That marker no longer exists.**

**Revised 2026-08-30 — plot interaction rework.** The plot was reworked again after the record
above. **None of this has been confirmed in a browser**: the Chrome extension is disconnected, so
treat the list below as *written, lint-clean, and reasoned* — not verified. The aria-label and tile
counts from the 2026-08-29 pass still hold; the interaction claims do not yet.

- **Self-identification moved from a floating marker to the tile itself.** The hollow leaf pin was
  removed as clutter. Your plot is now `fill-plot-edge` (the tile hairline colour, so a shade deeper
  than its neighbours) plus a `stroke-primary` outline. `tileFill()` in `plot.tsx` is the single
  decision point. **Over-baseline still wins the fill** — amber is the alarm channel and an identity
  cue must never override it, which is why the outline exists: it is what identifies you on the day
  you are the one flagged. Your tree stays; removing it would destroy "height is the ranking" for
  your own plot.
- **Selecting a plot lifts its tree.** The selected tree is appended **last** in the tree list so it
  paints over its neighbours — SVG has no `z-index`, paint order *is* stacking order — and scales to
  1.1 over 180 ms, animating back down on deselect.
  - **The scale origin must be percentage-based**: `originX: 0.5, originY: 1` with
    `transformBox: "fill-box"`. **Never absolute viewBox coordinates.** Animating a transform prop on
    an SVG element makes `motion` force `transform-box: fill-box` (confirmed in
    `motion-dom/dist/es/effects/style/index.mjs`), so an origin like `"156px 140px"` is then measured
    from each tree's *own* bounding box. The error is proportional to the tile's distance from
    centre, so the left and right columns slid sideways while the middle looked correct.
  - The order array is built with **filter + append, not `findIndex` indexing**. With nothing
    selected `findIndex` returns `-1`, `arr[-1]` is `undefined`, and the `.map` destructure throws —
    a blank plot on first load and after every deselect.
- **Tapping elsewhere deselects.** Three paths: a transparent bare-ground `rect` behind the plot,
  empty tiles, and a document `pointerdown` listener. The inspector is deliberately **excluded** from
  that listener — Nudge lives inside it, and deselecting on `pointerdown` would unmount the button
  before its click ever landed.
- **Tiles carry `outline-none`.** The UA focus ring paints a rounded rect around the tile's
  *bounding box* (not the diamond) in the OS accent colour, which read as a stray orange box. Focus
  stays visible because focusing a tile selects it, so the selection ring is the focus indicator.
- **Rings now paint BEFORE the trees** (`{/* rings, behind the trees */}`), reversing the order
  DESIGN.md states. It serves "selected tree on top", but the trade-off is the one DESIGN.md warns
  about: a tall tree can now obscure its own selection ring. Recorded, not reverted.
- **Mobile sizing.** The viewBox was cropped `0 0 224 188` → `0 14 224 166` — dead sky only, tile
  44×22 and origin `(112, 74)` untouched — and capped with `max-h-[30dvh]` (`dvh`, because mobile
  browser chrome makes `vh` lie). Measured at a simulated 390px column: the plot SVG went 265px →
  234px and its card 330px → 299px.

---

## Phase 3 — EcoVolt Energy & Water Tracker

Goal: Comprehensive hardware telemetry page displaying 14-day energy & water trends and savings-to-points calculation.

### Backend & Data Queries
- [x] Query 14-day historical `readings` (energy and water) for the logged-in user in `src/app/(authed)/energy/page.tsx`.
- [x] Compute daily savings percentages: $(1 - \text{actual} / \text{baseline}) \times 100\%$.
- [x] Compute total points generated over 14 days and cumulative kWh reduction.

### Frontend Components
- [x] EcoVolt Device Status Banner: "EcoVolt Meter #NUS-EV-4029 • Live • 230V / 50Hz".
- [x] Energy Consumption Chart: 14-day SVG bar chart with baseline line, color-coding days below baseline (green) vs above baseline (amber).
- [x] Daily Energy Breakdown Table / List: Date, Baseline kWh, Actual kWh, Savings %, and Points Earned (+X pts).
- [x] Points Conversion Formula Explainer Card: Interactive visual explaining $1\% \text{ reduction} = 10\text{ points}$.
- [x] Water Telemetry Panel: 14-day water consumption chart (Liters vs baseline) with conservation impact score.

**Done when:** Energy and water charts render cleanly with baseline indicators; point calculations match the formula exactly; historical days align with seeded data.

**Status: built and verified against live Supabase and in Chrome (2026-08-30).**
Shipped as one page (`src/app/(authed)/energy/page.tsx`) plus a 4-line append to `src/lib/points.ts`.
No `src/components/energy/**` — every section is static server-rendered and nothing is reused twice,
so a component directory would have been scaffolding.

Verified by two scratch scripts that import the real `src/lib/points.ts` (not a reimplementation) and
query PostgREST directly: banner date `2026-08-28` = `max(readings.day)`; 14 energy + 14 water rows;
energy baseline frozen at 14.55 and water at 169.6 across the window (**this is what licenses
`BarChart`'s single scalar `baseline`**); all 14 rows satisfy `pts === max(0, savingsPct) × 10`; bar
*i* matches row *i*. The demo user has **zero** over-baseline days this fortnight, so that branch was
checked across all 462 energy rows instead — 90 over-baseline rows, every one amber and `+0 pts`.

Decisions and deviations, all deliberate:
- **`savingsPct(baseline, actual)` added to `points.ts` as a new export only.** `earnFor` was *not*
  refactored to call it, even though that is behaviour-identical — the test that would catch a
  mismatch (`over-usual.test.ts`) sits beside files this phase was fenced out of.
- **"Sync meter" is cut, and `/energy` therefore has no primary action**, deliberately leaving
  DESIGN.md non-negotiable 7 unfulfilled for this screen. PLAN.md §3 says telemetry streams at
  midnight; an on-demand pull button misrepresents the hardware. No replacement CTA was invented.
- **Device banner shows the last reading date, not a `live` pill**, for the same reason. It ticks
  forward when Phase 5's `demoAdvanceDay` lands.
- **Displayed % is the rounded integer `earnFor` uses**, so `−12%` and `+120 pts` reconcile exactly.
  DESIGN.md's `−18.6%` one-decimal example is deliberately not followed.
- **A day that rounds to zero prints `0%`, not `−0%`.** `Math.round` returns `-0` for a day
  fractionally *over* baseline, and `−0%` would claim a saving the user did not make. The under/over
  wording and the table's amber flag branch on the raw `actual > baseline` comparison, not the
  rounded percent, so a barely-over day can never be described as under.
- The dark panel is a bare `div` with `bg-panel`, not `Card` — `Card` hardcodes `bg-surface` and
  would leave two background utilities live on one element.
- **No repo-side test for `savingsPct`** (its natural neighbour is in a fenced directory). Reconciling
  it with `garden/over-usual.ts:overPercent` remains the documented follow-up.
- The chart caption is conditional: a clean fortnight reads "Every day stayed under it." rather than
  naming amber days that aren't on screen.

---

## Phase 4 — Rewards Economy & Group Quests

Goal: Full voucher redemption system for individual rewards and communal point contributions toward group goals.

### Backend & Server Actions
- [x] Page `src/app/(authed)/vouchers/page.tsx` loading personal and group vouchers from `vouchers`.
- [x] Server Action `contributePoints(groupId, amount)`:
  - Checks wallet balance and that `groupId` is one of the user's own groups. **This is a UX guard, not a security boundary** — see Standing Rule 6.
  - Inserts `ledger` entry (`kind='contribute'`, `group_id`, `points`).
  - Revalidates path `/vouchers`, `/garden/[groupId]`, and `/`.
- [x] Server Action `redeemVoucher(voucherId)`:
  - Checks wallet balance $\ge$ `vouchers.cost` (same caveat as above).
  - Inserts `ledger` entry (`kind='redeem'`, `points`).
  - Inserts `redemptions` entry with generated 8-character voucher code. **These are two independent inserts with no FK between them and no transaction** — if the second fails, points are deducted with no voucher. Insert `redemptions` first, then the `ledger` row, so the failure mode is a free voucher rather than stolen points.
- [x] Group voucher claim: when $\sum \text{contributions} \ge$ `goal_points`, insert a zero-cost `redemptions` row per member on demand. **Unlocking never consumes contributed points** — see PLAN.md §5.
- [x] Query user's past redemptions with timestamp and codes.

### Frontend Components
- [x] Available Wallet Balance Banner with "Contribute to Group" button.
- [x] Community Contribution Modal / Card: Slider or quick buttons (+50, +100, +250, Max) to invest points into group tree.
- [x] Group Quests Section: Shows locked/unlocked group rewards (Universal Studios, Escape Room) with live progress bar. If total contributions $\ge$ `goal_points`, display "🎉 UNLOCKED FOR ALL MEMBERS" with unlock code.
- [x] Personal Rewards Catalog: Grid of personal vouchers (LiHO Bubble Tea, GrabFood, Kopitiam, Cinema). Tapping "Redeem" triggers confirmation, deducts points, and reveals active voucher code with barcode illustration.
- [x] My Active Vouchers Drawer: View all claimed redemption codes with "Copy Code" action.

**Done when:** User can redeem a personal voucher, wallet updates instantly, and code appears in redemption history; contributing points pushes group quest bar closer to 100% and grows the group tree.

**Status: built and verified against live Supabase (2026-08-30).** All three actions were executed
for real, then `bun run seed` restored the pitch state (`Pitch unlock beat: … YES`, wallet 1282,
Solar Squad 4751/5000, gap 249). The seed clears `redemptions`, so no test vouchers survive.

Verified run: redeem "Free bubble tea" → wallet 1282 → 1082, one `redemptions` row with an 8-char
code, one `ledger` redeem row. Contribute 249 to Solar Squad → wallet 1082 → 833, `ledger` row
`contribute/249/group_id 1`, bar 5,000/5,000. Claim Universal Studios → one `redemptions` row and
**no ledger row**, group total unchanged at 5,000. Final DB delta: `ledger` 27 → 29 (exactly the two
expected rows), `redemptions` 0 → 2. Console clean on both pages.

Decisions and deviations, all deliberate:
- **Group unlock is an explicit Claim button**, never a write during render — a Server Component
  that inserts fires on every visit, prefetch included.
- **`revalidatePath` was added to `redeemVoucher` and `claimGroupVoucher` too**, not just
  `contributePoints` as this checklist says. The Done-when criteria (wallet drops, My vouchers gains
  a row, quest card flips) are unobservable without them. These are the repo's first `revalidatePath`
  calls.
- **`revalidatePath('/garden/[groupId]')` could not be isolated as the cause of the refresh.** The
  garden page did show 4,751 → 5,000 after contributing, but Next 16 gives dynamic segments
  `staleTime: 0` in the client Router Cache, so a soft nav refetches whether or not the revalidate
  fired. No stale read was observed; causation is unproven, not disproven.
- **`Max` contributes `min(wallet, shortfall)`**, not the whole wallet, so the unlock tap doesn't
  empty the wallet and leave the personal catalogue unaffordable in the same demo run.
- **`claimGroupVoucher` is idempotent** — a second tap returns the existing code rather than an
  error. Same read-then-write ceiling as everything else here.
- **Personal vouchers are repeat-purchasable by design.** Only group vouchers are one-per-member
  (PLAN.md:178); `redeemVoucher` deliberately has no already-redeemed guard.
- Wallet is re-derived inline rather than shared with `page.tsx:68-71`, matching the existing
  duplication at `garden/[groupId]/page.tsx:94`. Editing a verified screen was not worth three lines.

The overdraft ceiling is unchanged and still applies (Standing Rule 6) — these guards are UX, not
security. Do not describe them as validated.

---

## Phase 4.5 — Social Accountability & Waste Alerts

Goal: In-app notifications inbox, community energy waste broadcasts, and profile management.

> **Budget two hours, not one.** This phase is two pages, four server actions, and five components.
> If the clock is tight, cut the `/profile` stats grid first (see PLAN.md §7's cut list) — the
> pitch runbook never opens `/profile`.

### Backend & Server Actions
- [x] **Schema migration (apply before the next seed).** `events.photo_url`, `events.resolved_by`, and the `resolve_alert` **security definer** function. Clients may never insert `earn` (`"spend own points"` allows `contribute`/`redeem` only), so this function is the sole sanctioned mint path — Standing Rule 4 holds, no admin client in a user-facing route, no loosened policy.
- [x] Page `src/app/(authed)/alerts/page.tsx` querying open and resolved `events` for user's assigned groups and personal nudges. **Unread = `status = 'open'`**; there is no `read_at` column.
- [x] Server Action `resolveAlert(eventId, action: 'fixed' \| 'reported', photoUrl?)`: calls the `resolve_alert` RPC, which sets `status` / `photo_url` / `resolved_by` **and inserts the earn ledger row**. A return of `0` means the row was already claimed — a normal outcome with its own copy, not an error.
- [x] **Evidence-first payout ladder, enforced in the database** so a crafted request cannot pick its own number: `fixed` + photo = **100**, `reported` + photo = **50**, bare `reported` = **10**. `fixed` without a photo is rejected outright — the photo *is* the trust mechanism for the top award.
- [x] **First-responder-wins is atomic.** The `and status = 'open'` predicate lives inside the `UPDATE`, so two concurrent taps cannot both be paid. This is strictly safer than `contributePoints`, which is a documented read-then-write race (Standing Rule 6).
- [x] Server Action `dismissNudge(eventId)`: sets the nudge's `events.status` to **`fixed`**. The `status` check constraint allows only `open | fixed | reported` — there is no `dismissed`/`acknowledged` value and v1 does not add one. On a `kind='nudge'` row, `fixed` means acknowledged. The existing update policy already permits this (`kind = 'alert' or auth.uid() = to_user`).
- [x] Page `src/app/(authed)/profile/page.tsx` with user statistics and profile edit actions.
- [x] Server Action `signOut()`: signs out and redirects to `/login`.

### Frontend Components
- [x] Alerts Inbox: Tabs for "Community Waste Alerts" and "Peer Nudges".
- [x] Waste Alert Cards: "⚠️ Lights left on in Common Room (Level 3)" with "I turned them off (Mark Fixed)" and "Report Issue" buttons.
- [x] Peer Nudge Cards: "🌱 Alice sent you a leaf — no savings logged yesterday!" with "Got it" dismiss button.
- [x] Header Alert Badge: Updates count dynamically when alerts are resolved.
- [x] Profile View: Personal statistics summary, username update, avatar change, and sign out CTA.

**Done when:** Resolving an alert updates the database and clears the unread badge; profile updates username and avatar seamlessly.

**Status: built 2026-08-30; lint and `bun run build` clean. NOT yet verified — the migration
has not been applied.** This is the one phase whose "Done when" has not been demonstrated, and it
cannot be until `supabase/schema.sql` is re-applied (`bun run db:push`, or paste into the SQL
editor). Two things break until then, both expected:
- `/alerts` selects `photo_url` and `resolved_by`, which do not exist yet → PostgREST 400.
- **`bun run seed` fails**, because it now seeds one pre-resolved alert carrying `resolved_by`.
  Same rule as Phase 0 — schema before every fresh seed — just a sharper dependency than before.

Still to verify once applied: a real file-picker upload lands in the bucket; the award shows up in
the wallet and the leaderboard; the header bell's dot clears as alerts are resolved.

Deviations, all deliberate:
- **`/profile` ships without the stats grid**, which is PLAN.md §7's cut #1. It is avatar, username,
  community list and sign out — nothing else. The nav tab and the header bell no longer 404, which
  was the point.
- **`/profile` reuses `src/app/onboarding/form.tsx`** rather than duplicating the canvas re-encode,
  the taken-username collision handling and the avatar upload. That form gained one optional
  `redirectTo` prop so it stays on `/profile` instead of bouncing to the dashboard.
- **`signOut` is a plain `<form action={signOut}>`**, so it needs no client component. It signs out
  through the SSR client from `requireProfile()` on purpose: `src/proxy.ts` refreshes the session
  cookie on every request, so signing out on a fresh client would leave the cookie in place and the
  next navigation would walk straight back in.
- **Tabs are `<Link>` pills reading `?tab=nudges`, not JS tabs** — same approach as the garden's
  group selector, no client state.
- **Photos reuse the `avatars` bucket** at `avatars/<uid>/alert-<id>.jpg`. Its write policy is
  already scoped to `foldername(name)[1] = auth.uid()`, so this needed no new bucket and no new
  storage policy. **The bucket is public-read** (`"avatar read"` is `to public`) — evidence photos
  are therefore world-readable by URL. Accepted for the hackathon; say it rather than discover it.
- **Alert resolution mints `earn`, so it moves the wallet *and* the leaderboard** (leaderboard is
  `sum(earn)`). Intended: a common-room light is not on the resolver's own meter, so this attributes
  a real saving rather than double-paying one `earnFor()` already counted. PLAN.md §5 amended.
- **`src/lib/image.ts` is new and shared** — avatars want a 256px centre-crop, evidence photos want
  1024px uncropped, so `toJpeg(file, size, square)` serves both. Still throws on HEIC outside
  Safari; both call sites surface that as readable copy.
- The seed now creates **4 alerts, one pre-resolved**, so the inbox demonstrates the photo and
  credit layout without anyone having to resolve something first.


### Revised 2026-08-30 — reporting no longer closes an alert. **DECIDED, NOT YET BUILT.**

Everything above this line is built and verified. Everything in this block is a **pending change to
that built code**, agreed while planning Phase 5. Do not read the ticked boxes above as covering it.

**What changes.** `reported` stops being terminal and becomes an *intermediate* state. A report says
"this is real and still happening", not "this is dealt with". Only `fixed` closes an alert.

| State | Meaning | In the inbox | In the bell count |
|---|---|---|---|
| `open` | Nobody has touched it | Full card, both actions | counted |
| `reported` | Confirmed real, still broken | **Half state** — still listed, still fixable, shows who reported it and their photo | **counted** |
| `fixed` | Actually resolved | Settled card, shows fixer + photo | not counted |

**Consequences that must be handled, not discovered:**
- **The bell predicate changes.** `src/app/(authed)/layout.tsx` currently counts `status = 'open'`.
  It must count `status in ('open','reported')`, or a reported-but-unfixed alert silently stops
  nagging anyone — which is the whole point of the state.
- **`/alerts` open-first sorting** must treat `reported` as unsettled, not settled.
- **`resolve_alert` must stop being a single-shot claim.** Today the `and status = 'open'` predicate
  is what makes the claim atomic. Under the new model a `fixed` claim must also match a `reported`
  row, so the predicate becomes `status in ('open','reported')` for `fixed`, and stays
  `status = 'open'` for `reported`. Keep the claim inside the `UPDATE` — that atomicity is the
  property worth protecting.
- **One action per person per alert.** *"Same person can't upload multiple photos."* A user may act
  on a given alert **once**: report it, or fix it, never both and never twice. Someone else may
  still come along and fix what you reported.
  - `resolved_by` alone cannot express this — a reported-then-fixed alert has two distinct actors.
    Either add `reported_by` / `report_photo_url` alongside the existing `resolved_by` / `photo_url`,
    or introduce an `event_actions(event_id, user_id, action, photo_url)` table. **The two-column
    version is the smaller change and only records the *first* reporter; the table version supports
    many reporters. Pick before building.**
- **Both actors keep their points.** The reporter's 50 is not clawed back when someone else fixes it
  later, and the fixer still earns 100. They did two different useful things.

**Open assumption to confirm before building:** "one action per person" is read as *one action per
person per alert*. If you meant "one photo per person globally" or "a reporter may later fix their
own report", say so — it changes the guard.
---

## Phase 5 — Demo Rig & Pitch Rehearsal

Goal: Hidden control room (`/demo`) for flawless live hackathon presentation and 3-minute pitch runbook.

### Backend & Demo Engine

> **Every action in this phase must use `createAdminClient()`** (`src/lib/supabase/admin.ts`). RLS
> deliberately blocks all of them for a normal client: `ledger` clients may insert only
> `contribute`/`redeem` (never `earn`), `events` clients may insert only `nudge` (never `alert`),
> and `readings` has no client insert policy at all. **If you hit an RLS error here, switch to the
> admin client — never loosen a policy.** See Standing Rule 4.

- [ ] Page `src/app/(authed)/demo/page.tsx` (unlinked from nav, accessible via direct URL).
- [ ] Server Action `demoAdvanceDay()`:
  - Finds latest recorded date in `readings` (`latestDay()` in `src/lib/points.ts`).
  - Generates next day's energy **and water** readings for all users. Reuse each user's existing `baseline` — baselines are frozen (PLAN.md §3), so read it from the previous row rather than recomputing.
  - Calculates and inserts `earn` ledger entries for users who saved energy, via `earnFor()`.
  - Guard against a zero baseline: `earnFor(0, 0)` returns `NaN`, which fails the `points > 0` check as an opaque insert error.
  - Revalidates all routes.
- [ ] Server Action `demoTriggerWasteAlert(groupId, location, message)`: inserts an immediate open
      waste alert. **Parameterised, not hardcoded** — pick **any** of the three groups and **any**
      location, so the alert can be aimed at whichever garden is on screen. The `/demo` form carries
      a group selector, a free-text location, and a few one-tap presets ("Lights left on in Common
      Room (Level 3)", "Aircon running with the windows open", "Pantry kettle left on the boil").
- [ ] Server Action `demoZeroUserSavings(userId)`: adjusts yesterday's reading for a fake user to zero savings so they become immediately nudgeable during the demo.
- [ ] Server Action `demoBoostGroup(groupId, targetPoints)`: inserts `contribute` rows until the
      group reaches **a target you choose**, not a hardcoded 99%. This is what sets up the
      celebration: park a group a few points short to rehearse the unlock, or drop it far back to
      show the bar climbing. Offer presets (99% · 90% · 50%) plus an exact-points field. Guard the
      target above the group's current total — the ledger is append-only, so a boost can never walk
      a group *backwards*; only a re-seed can.
- [ ] Server Action `demoResetSeed()`: resets and re-runs deterministic seed for clean demo repeats. *(Still cuttable — `bun run seed` from a terminal does the same job, and the status panel below tells you when you need it.)*

### Frontend & Rehearsal
- [ ] **Pitch-state status panel, at the top of `/demo`.** Not in the original spec; added because
      nothing else tells you the rehearsal left state dirty until you are already on stage. One
      read-only readout, refreshed on every action:
      Solar Squad total **and gap** · demo user's wallet · open + reported alert counts ·
      latest reading date · whether each group voucher is already claimed.
      This is what replaces a working `demoResetSeed` button: it tells you *when* to go run
      `bun run seed` in a terminal, which is the part you would otherwise get wrong.
- [ ] **Access gate on `/demo`.** `notFound()` unless the signed-in user is the demo account. The
      route is unlinked but fully reachable on the deployed URL, and it mints `earn`, raises alerts
      and contributes on other people's behalf. Two lines; stops a judge finding a points faucet.
- [ ] **Double-tap safety on `demoAdvanceDay`.** `readings` has `unique(user_id, day, kind)`, so a
      second tap either throws a constraint error mid-pitch or double-pays. Upsert the readings and
      skip users who already have an `earn` row for that day. Assume the button *will* be tapped
      twice — stages are stressful.
- [ ] Quick-action demo stage buttons:
  - "⏩ Advance 1 Day (Move Charts & Leaderboard)"
  - "🚨 Trigger Waste Alert" — group selector + location, per `demoTriggerWasteAlert` above
  - "🎯 Make Alice Nudgeable"
  - "✨ Boost Group to Target" — target selector, per `demoBoostGroup` above
- [ ] Mobile viewport visual review on iPhone & Android screen dimensions.
- ~~Micro-animations audit~~ — **moved out to [Phase 6](#phase-6--game-feel--polish).** It was the
  only game-feel item in this phase and it had no acceptance criteria here, because this phase's
  Done-when is entirely about the runbook. Phase 6 runs **alongside** this one; do not treat it as
  blocked on the rig. **The unlock celebration lives there too** — `demoBoostGroup`'s settable
  target is the control that *triggers* it, which is why the target is a Phase 5 item and the
  animation is not.

> **Ordering constraint — `demoAdvanceDay` must stay last in the runbook.** It regenerates every
> user's savings for a new day, which changes who is "not earning" in the garden. Run it before the
> nudge beat and `alice.tan` may no longer be a valid nudge target, silently breaking step 2.

> **Running in parallel: the Vercel deploy** (outstanding since Phase 1, and PLAN.md §7 says do not
> leave hosting past hour 11). Tejas owns the Vercel project and env vars; this phase owns the rig.
> `/demo` will not work deployed unless **`SUPABASE_SECRET_KEY` is set as a Vercel env var** — it is
> the only thing `createAdminClient()` reads, and every action in this phase depends on it.

**Done when:** the complete 3-minute runbook in PLAN.md §8 runs end-to-end **on the deployed URL**,
on a phone, without an error or a manual reload — including the revised step 5, where an alert is
raised from `/demo`, reported from the phone, and then fixed with a photo.

---

## Phase 6 — Game Feel & Polish

Goal: Make the app *feel* like a game without breaking the Field Notes spec — starting with the one
celebration the pitch runbook already promises but the app does not actually have.

> **This phase runs ALONGSIDE Phase 5, not after it.** The rule at the top of this file — "don't
> start phase N+1 until phase N's Done-when passes" — does **not** apply here. The demo rig lives in
> `app/(authed)/demo/**` plus admin server actions; this phase lives in `components/**`. They share
> no files. Exactly one item couples them (the day-rollover set piece needs `demoAdvanceDay()`), and
> that item is deferred below.

> **Why this is its own phase.** It used to be a single bullet inside Phase 5 ("Micro-animations
> audit"), under a phase whose Goal and Done-when are entirely about the `/demo` control room. So
> this work had **no acceptance criteria of its own** and inherited the hour that gets eaten first
> when the rig overruns. That is backwards: **Fun & Engagement is 40% of the score — more than
> Behaviour Change and Stickiness combined — while the demo rig scores 0 points directly.**

> **Budget: ~1 hour.** Enough for the shared primitives plus **one** money shot. Half-finished
> animation reads as *broken* and scores worse than none, so everything under the STOP line is
> deferred deliberately, not attempted optimistically.

### Scope decision — the unlock, not the redeem crate

The original ask was a Clash-Royale-style chest on voucher redemption. **Redeeming a personal
voucher appears nowhere in the 3-minute runbook.** Runbook step 4 is the group unlock, and PLAN.md §8
already writes a cheque the app does not cash:

> Contribute the ~250 pt gap from wallet $\rightarrow$ **live animation triggers unlocking** the
> group reward for all members.

The hour therefore goes to the contribute-to-unlock beat on `/vouchers` — the one moment judges are
guaranteed to watch. **The crate is deferred, not cancelled** (see the deferred list).

### The design tension, and how it resolves

Clash Royale is gradients, bevels and glow; `DESIGN.md` non-negotiables 3–5 ban all of it. Chasing
CR's *surface* breaks the locked spec and loses the "serious instrument" half of the brief.

**Steal the choreography, not the chrome.** What makes a chest feel good is pacing — anticipation, a
held beat, a burst, a staggered reveal. Timing is free within the spec. Two accidents of the design
system help: `panel` (`#2a3328`) already exists as a legitimate dark surface, and the locked
monospace face makes count-ups and stagger reveals layout-shift-free.

### Build order — stop anywhere; each step leaves the app coherent

- [ ] **0. `src/components/fx/motion-config.ts`** — shared springs/durations wired to motion's
  `useReducedMotion()`.
  - **This fixes a live accessibility bug, not just future work.** `globals.css` only zeroes CSS
    `animation-duration` / `transition-duration`; `motion/react` animates via JS and ignores it.
    There is no `MotionConfig` and no `useReducedMotion` anywhere in `src/`, so **every animation
    already in the app bypasses the user's stated preference today.**
  - Five files animate with four hardcoded durations (`0.18`, `0.3`, `0.35`, `5.0` infinite), and
    `whileTap={{ scale: 0.97 }}` is duplicated verbatim in `ui/button.tsx` and
    `dashboard/cta-link.tsx`. Centralise them here.
- [ ] **1. `src/components/fx/count-up.tsx`** — client leaf animating a number to its target;
  renders the final value immediately under reduced motion. Best sites: the two 42px wallet heroes
  (`(authed)/page.tsx`, `(authed)/vouchers/page.tsx`) and the 36px goal hero on `/vouchers`.
  - **`StatCard.value` is typed `string`** and callers pass pre-formatted `toLocaleString()` output,
    so CountUp cannot drop in there without changing that prop type. Leave `StatCard` alone.
- [ ] **2. `src/components/ui/progress-bar.tsx`** — animated fill + a living leading edge.
  - It is currently a **server** component whose only animation is `transition-[width] duration-700`.
    It must gain `"use client"`. It is a leaf with three server-component callers
    (`(authed)/page.tsx`, `(authed)/vouchers/page.tsx`, `garden/goal-banner.tsx`), none of which pass
    `className`, so the conversion is safe.
  - **That CSS transition is the only rule the reduced-motion block currently affects in the whole
    app.** Converting it to motion without step 0 in place is a straight accessibility regression.
  - **Never animate the bar's width to look "alive".** It encodes a real number; breathing its length
    lies about the data. Animate the *edge* — a small `surface` pip on the fill's leading edge — and
    never the length.
- [ ] **3. `src/components/fx/burst.tsx`** — a few flat leaf particles in `canopy` / `canopy-deep`.
  Transform and opacity only, low particle count, no new dependency. If the hour is tight, inline it
  into step 4 rather than generalising it.
- [ ] **4. `src/components/fx/moment.tsx`** — the takeover shell. Full-screen `panel` surface:
  enter $\rightarrow$ hold $\rightarrow$ **tap anywhere to skip** $\rightarrow$ exit. Kept generic so
  the deferred crate and bounty payout reuse it without redesign. **Never block input for longer than
  the skip affordance takes to notice.**
- [ ] **5. The unlock beat — `src/components/rewards/contribute-card.tsx`.**
  - **No server change needed.** `contributePoints` returns a bare `{ ok: true }` with no total, but
    the card already receives everything required: `ContributeTarget.shortfall` is an existing prop
    ("Points the whole group still needs. 0 once the goal is crossed"). Fire when
    `active.shortfall > 0 && amount >= active.shortfall`, inside the existing `startTransition`
    success path alongside `setGiven`.
  - Sequence: bar springs to full with the ratio counting up $\rightarrow$ brief overshoot
    $\rightarrow$ `Moment` with a `Burst` and "UNLOCKED FOR ALL {n} OF YOU".
  - **Fire from the action callback only, never from render state.** Nothing in the app records
    *when* the goal was crossed — `/vouchers` derives `short === 0` server-side — and there is **no
    `localStorage` anywhere in `src/`** to dedupe against. Triggering on the transient callback means
    a later page load cannot re-fire it, which is the behaviour we want and needs no persistence.
- [ ] **6. Cheap bonus, only if minutes remain — stagger `FadeIn`.** `motion/fade-in.tsx` has no
  `delay` and is used **26 times across 6 pages**, so every section on a page animates in
  simultaneously. An optional `delay` prop plus staggered sections is a handful of lines and lifts
  every screen at once.

> ### STOP LINE — everything above is the hour. Everything below stays unticked.

**Done when:** contributing the seeded 249-pt gap on `/vouchers` animates the bar to 5,000/5,000 with
the number counting up, fires the takeover exactly once, and dismisses on tap; a contribution that
does *not* cross the goal fires nothing; reloading `/vouchers` afterwards does not re-fire it; and
with `prefers-reduced-motion: reduce` set, final values render immediately with nothing unreachable.

### Deferred — in the order to build next

- [ ] **Redeem crate.** Dark takeover, crate shakes with rising amplitude, bursts, 8-character code
  stagger-revealed, rarity tier from voucher cost driving particle count. Much cheaper once `Moment`
  and `Burst` exist. Confirmed feasible: `redeemVoucher` already returns `{ ok, code }`, and
  `RedeemButton` survives the revalidate so the code stays in client state.
- [ ] **Alert bounty payout.** Phase 4.5 shipped an evidence-first bounty (100 / 50 / 10, enforced in
  Postgres) with a **first-responder-wins atomic claim** — already a game mechanic, currently
  rendered as a sentence. `resolveAlert` returns `{ ok, points }` and `alerts/alert-card.tsx` already
  holds it in `awarded` state, so the number is in hand and this is nearly free.
- [ ] **Tree stage-up pop.** `components/tree.tsx` uses `AnimatePresence mode="wait"`, so the two
  0.35s halves run sequentially (~0.7s of crossfade). Should overshoot and burst instead. Note `Tree`
  has no memory of its previous stage, so "just grew" has to be derived.
- [ ] **Tap feedback pass** — beyond `ui/button.tsx` to cards and plot tiles.
- [ ] **Sound.** Web Audio oscillators, no asset files, no new dependency, **default OFF** with a
  visible toggle on `/profile` so it can be switched on at the podium. Cut from the hour: build cost
  and risk for zero pitch value while muted. Note there is **no client persistence layer at all**
  today, so the toggle would introduce the first one.
- [ ] **Garden spectacle** — nudge leaf-flight across the isometric plot; group MVP crown.
- [ ] **Day rollover** — tiles ripple in depth order when time advances. **The only item blocked on
  Phase 5** (`demoAdvanceDay`).

### Companion doc changes (not yet done)

- [ ] **`DESIGN.md` — fenced amendment**, in the style of the existing goal-artwork exception:
  - The dark `panel` takeover is permitted for a **named, closed list** of events (group unlock now;
    crate and bounty payout later). It is not a general-purpose surface.
  - Particles use flat token colours only. **`plot-hot` and `flag` stay off-limits as decoration** —
    they are the alarm channel, the same fence that already binds goal artwork.
  - A full-screen transition fading in is **not** an "opacity ramp in artwork" (non-negotiable 5).
    State this explicitly or a future session correctly reverts the work as off-spec.
  - Record that `motion/react` needs `useReducedMotion()`, because the CSS block does not reach it.
- [ ] **`PLAN.md` §7** — add Phase 6 to the timeline as a parallel track, and add its deferred items
  to the cut table so the cut order is decided now rather than at the podium.

### Blockers and verification notes

- **Apply the Phase 4.5 migration first.** Until then `/alerts` 400s and `bun run seed` fails, so
  `/vouchers` has no live data to rehearse the unlock against. `bun run db:push`, or the SQL editor.
- **Everything in this phase is a rendering behaviour that static output cannot prove.** It has to be
  watched in a browser, at phone width — not a desktop column, and not inferred from SSR HTML.
- Rehearse the actual runbook beat rather than a synthetic one: the numbers on stage are the seeded
  4,751 / 5,000 with a 249 gap.

### Two unrelated findings, recorded so they are not lost

Neither is in this phase's scope.

- **`ClaimQuestButton`'s `setCode` is dead code.** `(authed)/vouchers/page.tsx` swaps the button for
  `VoucherCode` as soon as `revalidatePath` lands, discarding the state set in the same transition.
  Harmless today because the code is also derived server-side from `redemptions`, but the client
  branch never renders.
- **`alerts/alert-card.tsx` calls `URL.createObjectURL(f)` and never revokes it** — a small leak per
  photo preview.

---

## Standing Rules While Implementing

> **Single source of truth.** The points constants (`STAGES`, stage names, `earnFor`) live in
> `src/lib/points.ts`; the design tokens live in `src/app/globals.css` with `DESIGN.md` as their
> prose reference. CLAUDE.md, AGENTS.md, GEMINI.md and PLAN.md §5 currently restate several of
> these — when a number changes, change it in the source file and let the agent docs point at it
> rather than re-copying. Five copies of a threshold is five chances to be wrong.


1. **Light Theme Only**: No dark mode variations. Use `@theme` CSS tokens from `src/app/globals.css` (`bg-background`, `text-primary`, `border-border`, `bg-plot-hot`, `fill-canopy`, `text-flag`, …). Never hardcode hex codes or default Tailwind zinc/lime classes. Flat fills only — no gradients, no shadows, no opacity ramps in artwork.
2. **Server Component Purity**: All `page.tsx` files remain `async` server components with direct DB queries. Interactive elements, motion animations, and stateful popovers must be small `"use client"` leaf components. **Documented exception:** `src/app/login/page.tsx` is `"use client"` in full — it is a pure auth form with no server data to fetch, and it is the only such page.
3. **Ledger Immutability**: Points are never directly edited on a user table. Every point change must be recorded as an immutable `ledger` entry (`earn`, `contribute`, `redeem`).
4. **Auth & RLS Integrity**: Every new table and operation must respect Supabase RLS. Never bypass RLS in user-facing routes. **`/demo` is the sole exception** and must use `createAdminClient()` from `src/lib/supabase/admin.ts`. This is not a workaround — RLS intentionally forbids what the demo rig does (`ledger` clients may insert only `contribute`/`redeem`, never `earn`; `events` clients may insert only `nudge`, never `alert`; `readings` has no client insert policy at all). **If a demo action returns an RLS error, reach for the admin client — never loosen a policy.**
5. **Mobile-First Layout**: All screens must fit cleanly within the `max-w-md` container.
6. **Known ceiling — the ledger is not overdraft-safe.** `contributePoints` and `redeemVoucher` validate the wallet balance in the Server Action, which is a UX guard, **not** a security boundary: it is a read-then-write race, and a client with its own JWT can insert an unbacked `contribute`/`redeem` straight through PostgREST, into any `group_id`, without the action running. Accepted for the hackathon. **Do not describe this as validated or secure.** Upgrade path: one `security definer` Postgres function doing the balance + membership check and the insert atomically, with the direct `ledger` insert policy dropped. See PLAN.md §5.
