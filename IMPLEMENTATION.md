# Evergreen — Implementation Plan

Task-level breakdown and live progress report for Evergreen. Work top to bottom; each phase ends with a runnable check. Don't start phase N+1 until phase N's "done when" passes. Keep this file updated: check boxes off, add discovered tasks under the phase they belong to.

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
| `resolveAlert` | 4.5 | Server Action | Update `events.status` (`open` $\rightarrow$ `fixed` / `reported`) |
| `dismissNudge` | 4.5 | Server Action | Update a nudge's `events.status` $\rightarrow$ `fixed` (= acknowledged) |
| `/profile` | 4.5 | Server Component | Profile overview, avatar update |
| `signOut` | 4.5 | Server Action | `supabase.auth.signOut()` + redirect to `/login` |
| `/demo` | 5 | Server + Actions | Advance day, trigger waste alert, zero user savings, boost group |
| `demoAdvanceDay` | 5 | Server Action (**admin**) | Generate next day's readings + `earn` ledger rows for all users |
| `demoTriggerWasteAlert` | 5 | Server Action (**admin**) | Insert an open `kind='alert'` row |
| `demoZeroUserSavings` | 5 | Server Action (**admin**) | Zero a target user's latest reading so they become nudgeable |
| `demoBoostGroup` | 5 | Server Action (**admin**) | Push a group's contributions to ~99% of `goal_points` |
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
- [x] `src/components/charts/bar-chart.tsx` — Server-rendered SVG bar chart with dashed baseline.
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
  - Members over baseline fill their tile `plot-hot` and increment an `N leaking` counter in the plot header.
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
- **Your own plot carries a permanent hollow leaf marker.** aria-label reads
  `tejasbuilds, your plot, Young Tree`. Verified it survives searching for someone else, and that
  selecting your own plot suppresses the solid selection dot so the two never stack at `y-46`.

---

## Phase 3 — EcoVolt Energy & Water Tracker

Goal: Comprehensive hardware telemetry page displaying 14-day energy & water trends and savings-to-points calculation.

### Backend & Data Queries
- [ ] Query 14-day historical `readings` (energy and water) for the logged-in user in `src/app/(authed)/energy/page.tsx`.
- [ ] Compute daily savings percentages: $(1 - \text{actual} / \text{baseline}) \times 100\%$.
- [ ] Compute total points generated over 14 days and cumulative kWh reduction.

### Frontend Components
- [ ] EcoVolt Device Status Banner: "EcoVolt Meter #NUS-EV-4029 • Live • 230V / 50Hz".
- [ ] Energy Consumption Chart: 14-day SVG bar chart with baseline line, color-coding days below baseline (green) vs above baseline (amber).
- [ ] Daily Energy Breakdown Table / List: Date, Baseline kWh, Actual kWh, Savings %, and Points Earned (+X pts).
- [ ] Points Conversion Formula Explainer Card: Interactive visual explaining $1\% \text{ reduction} = 10\text{ points}$.
- [ ] Water Telemetry Panel: 14-day water consumption chart (Liters vs baseline) with conservation impact score.

**Done when:** Energy and water charts render cleanly with baseline indicators; point calculations match the formula exactly; historical days align with seeded data.

---

## Phase 4 — Rewards Economy & Group Quests

Goal: Full voucher redemption system for individual rewards and communal point contributions toward group goals.

### Backend & Server Actions
- [ ] Page `src/app/(authed)/vouchers/page.tsx` loading personal and group vouchers from `vouchers`.
- [ ] Server Action `contributePoints(groupId, amount)`:
  - Checks wallet balance and that `groupId` is one of the user's own groups. **This is a UX guard, not a security boundary** — see Standing Rule 6.
  - Inserts `ledger` entry (`kind='contribute'`, `group_id`, `points`).
  - Revalidates path `/vouchers`, `/garden/[groupId]`, and `/`.
- [ ] Server Action `redeemVoucher(voucherId)`:
  - Checks wallet balance $\ge$ `vouchers.cost` (same caveat as above).
  - Inserts `ledger` entry (`kind='redeem'`, `points`).
  - Inserts `redemptions` entry with generated 8-character voucher code. **These are two independent inserts with no FK between them and no transaction** — if the second fails, points are deducted with no voucher. Insert `redemptions` first, then the `ledger` row, so the failure mode is a free voucher rather than stolen points.
- [ ] Group voucher claim: when $\sum \text{contributions} \ge$ `goal_points`, insert a zero-cost `redemptions` row per member on demand. **Unlocking never consumes contributed points** — see PLAN.md §5.
- [ ] Query user's past redemptions with timestamp and codes.

### Frontend Components
- [ ] Available Wallet Balance Banner with "Contribute to Group" button.
- [ ] Community Contribution Modal / Card: Slider or quick buttons (+50, +100, +250, Max) to invest points into group tree.
- [ ] Group Quests Section: Shows locked/unlocked group rewards (Universal Studios, Escape Room) with live progress bar. If total contributions $\ge$ `goal_points`, display "🎉 UNLOCKED FOR ALL MEMBERS" with unlock code.
- [ ] Personal Rewards Catalog: Grid of personal vouchers (LiHO Bubble Tea, GrabFood, Kopitiam, Cinema). Tapping "Redeem" triggers confirmation, deducts points, and reveals active voucher code with barcode illustration.
- [ ] My Active Vouchers Drawer: View all claimed redemption codes with "Copy Code" action.

**Done when:** User can redeem a personal voucher, wallet updates instantly, and code appears in redemption history; contributing points pushes group quest bar closer to 100% and grows the group tree.

---

## Phase 4.5 — Social Accountability & Waste Alerts

Goal: In-app notifications inbox, community energy waste broadcasts, and profile management.

> **Budget two hours, not one.** This phase is two pages, four server actions, and five components.
> If the clock is tight, cut the `/profile` stats grid first (see PLAN.md §7's cut list) — the
> pitch runbook never opens `/profile`.

### Backend & Server Actions
- [ ] Page `src/app/(authed)/alerts/page.tsx` querying open and resolved `events` for user's assigned groups and personal nudges. **Unread = `status = 'open'`**; there is no `read_at` column.
- [ ] Server Action `resolveAlert(eventId, action: 'fixed' | 'reported')`: updates `events.status` to `fixed` or `reported`.
- [ ] Server Action `dismissNudge(eventId)`: sets the nudge's `events.status` to **`fixed`**. The `status` check constraint allows only `open | fixed | reported` — there is no `dismissed`/`acknowledged` value and v1 does not add one. On a `kind='nudge'` row, `fixed` means acknowledged. The existing update policy already permits this (`kind = 'alert' or auth.uid() = to_user`).
- [ ] Page `src/app/(authed)/profile/page.tsx` with user statistics and profile edit actions.
- [ ] Server Action `signOut()`: signs out and redirects to `/login`.

### Frontend Components
- [ ] Alerts Inbox: Tabs for "Community Waste Alerts" and "Peer Nudges".
- [ ] Waste Alert Cards: "⚠️ Lights left on in Common Room (Level 3)" with "I turned them off (Mark Fixed)" and "Report Issue" buttons.
- [ ] Peer Nudge Cards: "🌱 Alice sent you a leaf — no savings logged yesterday!" with "Got it" dismiss button.
- [ ] Header Alert Badge: Updates count dynamically when alerts are resolved.
- [ ] Profile View: Personal statistics summary, username update, avatar change, and sign out CTA.

**Done when:** Resolving an alert updates the database and clears the unread badge; profile updates username and avatar seamlessly.

---

## Phase 5 — Demo Rig & Pitch Polish

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
- [ ] Server Action `demoTriggerWasteAlert(groupId, message)`: inserts immediate open waste alert into `events`.
- [ ] Server Action `demoZeroUserSavings(userId)`: adjusts yesterday's reading for a fake user to zero savings so they become immediately nudgeable during the demo.
- [ ] Server Action `demoBoostGroup(groupId)`: inserts `contribute` rows until the group sits at ~99% of `goal_points` — the safety net for the pitch's unlock beat if the seed lands off-target.
- [ ] Server Action `demoResetSeed()`: resets and re-runs deterministic seed for clean demo repeats. *(Cuttable — re-run `bun run seed` from a terminal instead.)*

### Frontend & Pitch Polish
- [ ] Quick-action demo stage buttons:
  - "⏩ Advance 1 Day (Move Charts & Leaderboard)"
  - "🚨 Trigger Energy Anomaly Alert"
  - "🎯 Make Alice Nudgeable"
  - "✨ Boost Group to 99% Goal"
- [ ] Micro-animations audit: smooth `motion/react` spring transitions on tree growth, wallet counter roll-up, and unlock celebrations.
- [ ] Mobile viewport visual review on iPhone & Android screen dimensions.

**Done when:** Complete 3-minute pitch runbook can be executed end-to-end without errors or reloads.

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
