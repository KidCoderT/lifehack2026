# Evergreen — Product & Engineering Plan

A mobile-first web application that turns energy and water conservation into a living communal garden. Built for LifeHack 2026 in 12 hours on Next.js 16 + Supabase, powered by simulated EcoVolt hardware meters.

---

## 1. Product Vision & Value Proposition

Every EcoVolt-enabled location (NUS residential colleges, hall floors, academic blocks, corporate offices, JC/Polytechnic campuses) is configured as a **Community**. People living or working in that physical zone are jointly responsible for its utility footprint.

Instead of abstract kWh graphs and passive awareness posters, Evergreen transforms conservation into an active, social game:
1. **Reduce consumption below your baseline** $\rightarrow$ Earn points daily (1% savings = 10 pts).
2. **Points act as fertilizer** $\rightarrow$ Grow your personal tree within your community's 5×5 garden matrix.
3. **Dual-use currency** $\rightarrow$ Spend points on personal treats (bubble tea, GrabFood) or pool points toward communal quests (Universal Studios passes, escape rooms).
4. **Peer accountability & rapid response** $\rightarrow$ Nudge peers who missed savings and broadcast instant alerts for active energy waste (e.g., lights left on in common rooms).

---

## 2. Hackathon Judging Criteria Alignment

| Criterion | Weight | Product Strategy & Implementation |
|---|---|---|
| **Fun & Engagement** | **40%** | Animated SVG tree growing across 6 stages (`motion/react`), interactive 5×5 community garden grid, visual leaf nudges, live unlock celebration effects for communal milestones. |
| **Behavior Change** | **20%** | Direct financial & gamified incentive loop (1% energy drop = 10 pts); peer-to-peer social accountability (gentle nudges, collective pride in group tree canopy). |
| **Stickiness** | **20%** | Stable per-user baseline so daily scores stay comparable, weekly performance trends, monthly impact stats, dynamic global & community leaderboards, ongoing communal quests that survive initial novelty. |
| **Craft & Usability** | **20%** | Strictly enforced light-theme aesthetic, crisp design tokens, mobile-first responsive viewport (`max-w-md`), instant navigation, robust auth & onboarding, and seamless live demo control room (`/demo`). |

---

## 3. Hardware Integration Context (EcoVolt)

Evergreen integrates with **EcoVolt** ([https://www.ecovolt.ai/](https://www.ecovolt.ai/)) smart energy and water meters deployed across physical rooms and facilities.

### Organization & Email Allocation
- Facility managers / organization administrators configure physical locations (e.g., "SOC" = Sheares Hall Block A Level 3).
- Users are pre-assigned to groups based on their institutional email addresses (`@u.nus.edu`, `@office.com`, `@poly.edu.sg`).
- An individual can belong to multiple groups (e.g., their Residential Floor + their Academic Project Lab).

### Telemetry & Baselines
- EcoVolt hardware establishes a **per-user baseline** for both electrical energy (kWh) and water usage (L), computed from a 7-day observation window when the meter is commissioned.
- **The baseline is frozen at enrolment, not rolling.** This is a deliberate design decision, not a
  simplification. A rolling baseline recomputed from the user's own recent usage would mean that
  sustained saving lowers the bar, shrinking the measured savings percentage and driving earnings
  toward zero — the better you behave, the less you earn, and the mechanic extinguishes itself.
  A frozen baseline keeps every day's score meaningful against the same reference: *your
  pre-Evergreen habits*. `scripts/seed.ts` implements exactly this (one constant baseline per user
  across all 21 days), and `readings.baseline` is stored per row so a future re-baselining policy
  can change without a migration.
- Daily telemetry streams actual usage against the baseline at midnight.
- In the hackathon prototype, 21 days of deterministic telemetry are seeded (`scripts/seed.ts`), and `/demo` provides real-time time-travel controls to advance days on demand.

---

## 4. System Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile Client (Next.js 16)               │
│  - React 19 Server Components (Data Fetching & RLS Security)│
│  - Client Leaf Components (motion/react SVG tree animations)│
│  - Tailwind CSS v4 (@theme design tokens, light theme only) │
└───────────────┬─────────────────────────────▲───────────────┘
                │ Form Actions / RPC          │ Cookie Auth / SSR
                ▼                             │
┌─────────────────────────────────────────────────────────────┐
│               Supabase BaaS (Postgres 15)                   │
│  - Auth (Email/Password pre-provisioned accounts)           │
│  - RLS Policies (Row Level Security on all 8 tables)        │
│  - Single Immutable Ledger (earn, contribute, redeem)       │
│  - Storage Bucket (User avatar uploads + JPEG compression)  │
└─────────────────────────────────────────────────────────────┘
```

### Core Technologies
- **Framework**: Next.js 16.3.3 (App Router, Server Actions, Server Components)
- **Runtime & Package Manager**: Bun 1.3.14
- **Language**: TypeScript 5 (Strict mode)
- **Database & Auth**: Supabase (@supabase/ssr, @supabase/supabase-js)
- **Styling**: Tailwind CSS v4 with custom CSS variables in `src/app/globals.css`
- **Animations**: `motion` (`motion/react` v13)
- **Icons**: `lucide-react` (Strict rule: no emoji for UI icons)

---

## 5. Data Model & Economy Specification

### Database Tables (`supabase/schema.sql`)

1. **`groups`**: Physical community/location (`id`, `name`, `emoji`, `goal_title`, `goal_points`).
2. **`profiles`**: User profile (`id` references `auth.users`, `username`, `avatar_url`).
3. **`group_memberships`**: M:N mapping of users to assigned groups (`user_id`, `group_id`).
4. **`readings`**: Daily EcoVolt meter data (`id`, `user_id`, `day`, `kind` ∈ {energy, water}, `baseline`, `actual`).
5. **`ledger`**: Immutable point transaction log (`id`, `user_id`, `group_id`, `kind` ∈ {earn, contribute, redeem}, `points`, `day`).
6. **`vouchers`**: Reward catalog (`id`, `title`, `description`, `emoji`, `cost`, `scope` ∈ {personal, group}, `group_id`).
7. **`redemptions`**: Claimed vouchers (`id`, `user_id`, `voucher_id`, `code`, `created_at`).
8. **`events`**: Social activity log (`id`, `kind` ∈ {nudge, alert}, `group_id`, `from_user`, `to_user`, `message`, `status` ∈ {open, fixed, reported}, `created_at`, `photo_url`, `resolved_by`).

### Points Mathematics & Ledger Balances

$$\text{Daily Energy Reduction \%} = \max\left(0, \text{round}\left(\left(1 - \frac{\text{Actual kWh}}{\text{Baseline kWh}}\right) \times 100\right)\right)$$

$$\text{Earned Points} = \text{Daily Energy Reduction \%} \times 10$$

- **Global Leaderboard Rank**: Derived from $\sum \text{points}$ where `kind = 'earn'`.
- **User Wallet Balance**: $\sum \text{earn} - \sum \text{contribute} - \sum \text{redeem}$.
- **User Tree Growth in Group $G$**: Governed by $\sum \text{points}$ where `kind = 'contribute'` and `group_id = G`.
- **Community Quest Progress**: $\frac{\sum_{m \in G} \text{contributions}_m}{\text{group.goal\_points}} \times 100\%$.

**Points are minted from electricity only, by two paths.** The meter mints them automatically via
`earnFor()`, and **resolving a community waste alert mints them manually** (see §6.6). Both are
electricity. Water readings are captured, charted on `/energy`, and count toward the conservation
narrative, but **they earn zero points in v1** — `earnFor()` in `src/lib/points.ts` takes energy
baseline/actual and nothing else. This is a scope decision, not an oversight: a second currency needs
its own baseline integrity story and doubles the balancing work. Water is **display-only in v1**; the
natural v2 is a separate water multiplier feeding the same ledger. Say this out loud if asked —
"NUSC" is a group name, not a second economy.

**Why alert resolution is not a second currency either.** A common-room light is not on the
resolver's personal meter, so the saving it represents is one `earnFor()` would otherwise never see.
Paying for it is *attribution of a real electricity saving*, not an invented reward — and there is no
double-count, because the kWh never appears on that user's own baseline comparison.

**Alert resolution is the one client-reachable path that mints `earn`, and it lives in the database.**
RLS on `ledger` authorises client inserts of `contribute`/`redeem` only, so the award runs inside the
`resolve_alert` **security definer** function in `supabase/schema.sql`. That function owns the payout
table, so a crafted request cannot choose its own number, and it claims the alert atomically
(`update ... where id = $1 and status = 'open'`), so two concurrent taps cannot both be paid.
Standing Rule 4 is intact: no admin client in a user-facing route, no loosened policy.

**Group quest unlock is a threshold, not a purchase.** When
$\sum_{m \in G} \text{contributions}_m \ge$ `groups.goal_points`, the group voucher becomes claimable
by **every member individually** (one `redemptions` row each, at zero cost). Contributed points are
**never consumed or refunded** by an unlock — they remain permanently as tree growth, which is what
keeps the garden from shrinking. Consequences that follow, and are intended:
- The progress bar, once full, stays full. The garden keeps growing past 100%.
- A group's "next quest" is a new `goal_title` / `goal_points` set by the facility manager, not an
  automatic reset. Multi-quest chains are out of scope for v1.

**Known ceiling — the ledger is not overdraft-safe.** RLS on `ledger` (`supabase/schema.sql`)
authorises inserts on `auth.uid() = user_id and kind in ('contribute','redeem')` and nothing more.
There is **no balance check and no group-membership check in the database**, so a client holding its
own JWT can insert an unbacked `contribute` or `redeem` — including into a group it does not belong
to — without any Server Action running. Balance validation in the Server Actions is a UX guard, not
a security boundary, and is a read-then-write race besides. This is an accepted hackathon shortcut.
**Upgrade path:** move both mutations into a single `security definer` Postgres function that checks
balance and membership and inserts atomically, then drop the direct `insert` policy on `ledger` so
the database becomes the only enforcement point.

### Tree Growth Stages

| Stage | Name | Contribution Range | Visual Characteristic |
|:---:|:---|:---:|:---|
| **0** | Seed | $0 - 49\text{ pts}$ | Planted seed in soil with subtle sprout shoot |
| **1** | Sprout | $50 - 149\text{ pts}$ | Vibrant twin-leaf seedling |
| **2** | Sapling | $150 - 399\text{ pts}$ | Growing trunk with layered foliage circles |
| **3** | Young Tree | $400 - 799\text{ pts}$ | Branching canopy structure with dual leaf clusters |
| **4** | Mature Tree | $800 - 1499\text{ pts}$ | Full robust foliage canopy with deep branching |
| **5** | Blossoming | $1500+\text{ pts}$ | Swaying canopy with glowing cherry blossoms |

---

## 6. Page-by-Page Feature Specifications

### 1. Auth & Onboarding (`/login`, `/onboarding`)
- **Login**: Org-issued email + password; immediate session cookie set via SSR.
- **Onboarding Gate**: `requireProfile()` intercepts users without a `username` and redirects to `/onboarding`.
- **Profile Setup**: Choose unique username (3–20 chars) + client-side avatar photo upload (resampled to 256px JPEG via canvas to handle HEIC/large files). Group allocation is fixed by the organization.

### 2. Dashboard (`/`)
- **Header**: Live unread alerts badge with pulsing indicator.
- **Wallet Overview**: Real-time available point balance + quick CTA to contribute or redeem.
- **My Trees Carousel**: Shows the user's personal tree in each assigned community with current stage name and points contributed. Tapping navigates to that Community Garden.
- **Energy Trend & Monthly Impact**: 7-day CSS bar chart with dashed baseline rule, plus weekly $\pm\%$ improvement metrics.
- **Global Leaderboard**: All-time top energy savers ranked by total earned points, highlighting the logged-in user's national rank.

### 3. Community Garden (`/garden/[groupId]`, `/garden`)
- **Top Quest Banner**: Communal goal progress bar (e.g., "$3,450 / 5,000\text{ pts}$ to unlock Universal Studios discount").
- **5×5 Garden Matrix Grid**: Interactive grid displaying all members' trees rendered at their exact individual growth stage.
- **Search & Filter**: Real-time username search to instantly focus and locate a peer's plot.
- **Tree Inspector Popover / Card**: Tap any tree or search result to inspect member stats (avatar, username, points contributed, current stage).
- **Social Nudge**: One-tap "Send Leaf Nudge" button on peers who have zero savings logged yesterday.

### 4. EcoVolt Energy Tracker (`/energy`)
- **EcoVolt Integration Header**: Hardware device status indicator (Online, 230V / 50Hz).
- **14-Day Energy Consumption Chart**: CSS bar chart (`components/charts/bar-chart.tsx`, **not** SVG — see DESIGN.md) comparing daily actual consumption against the dashed enrolment baseline (frozen per user — see §3).
- **Savings-to-Points Calculator**: Clear conversion formula display demonstrating $1\% = 10\text{ pts}$.
- **Water Consumption Panel**: Daily water volume tracking (Liters vs baseline) to monitor holistic resource efficiency.

### 5. Rewards & Vouchers (`/vouchers`)
- **Personal Vouchers**: Catalog of redeemable rewards (e.g., LiHO Bubble Tea, GrabFood $5, Kopitiam credit). Redeeming checks wallet balance, inserts a `redeem` ledger entry, and mints an 8-character redemption code.
- **Community Contribution Pool**: Interactive point allocation card allowing users to transfer wallet points into their community's tree fund.
- **Group Vouchers**: High-value collective perks (Universal Studios tickets, Escape room night) that unlock automatically for all members once the group goal is achieved.

### 6. Social Alerts & Inbox (`/alerts`)
- **Community Waste Broadcasts**: Alerts raised when energy anomalies or waste occur (e.g., "Lights left on in Common Room Level 3").
- **Photo evidence + an evidence-first payout ladder.** Resolving an alert opens the phone camera
  (`<input type="file" accept="image/*" capture="environment">`), and what you can prove sets what
  you earn:

  | Action | Proof | Points |
  |---|---|:---:|
  | I turned it off | photo **required** | **100** |
  | Can't fix it — report it | photo | **50** |
  | Can't fix it — report it | none | **10** |

  Proof is what pays, not the errand. Someone who genuinely cannot fix a thing is not punished for
  surfacing it, while a bare tap from the sofa never out-earns walking to the room. `fixed` without
  a photo is **rejected by the database**, not merely discouraged in the UI — the photo *is* the
  trust mechanism for the top award, so accepting it unproven would make the lower rungs pointless.
  v1 trusts the photo itself; there is no review queue and no image verification.
- **The payout table lives in Postgres**, inside `resolve_alert` (§5), so the client never names a
  number. Resolving also stamps `resolved_by`, which is what lets a settled card read
  "Fixed by alice.tan" — the social proof is the point, more than the points are.
- **First responder takes the award.** The claim is atomic, so a second tap earns nothing and says
  "Someone already handled this one."
- **Peer Nudges Inbox**: Incoming leaf nudges received from community peers with dismiss functionality.
- **Alert lifecycle — `reported` is an intermediate state, not an ending.** *(Decided 2026-08-30
  during Phase 5 planning; **built code still treats `reported` as terminal** — see
  IMPLEMENTATION.md Phase 4.5 "Revised".)* A report says *"this is real and still happening"*, not
  *"this is handled"*. Only **`fixed`** closes an alert.

  | State | Meaning | Inbox | Bell count |
  |---|---|---|---|
  | `open` | Untouched | Full card, both actions | counted |
  | `reported` | Confirmed real, still broken | **Half state** — still listed, still fixable, shows the reporter and their photo | **counted** |
  | `fixed` | Actually resolved | Settled, shows fixer + photo | not counted |

  So **unread = `status in ('open','reported')`** for alerts in the user's groups, plus nudges
  addressed to them with `status = 'open'`. A reported-but-unfixed alert must keep nagging the
  community — that is the entire reason the state exists.
- **One action per person per alert.** You may report it *or* fix it — never both, never twice.
  Someone else may still fix what you reported, and **both of you keep your points**: the reporter's
  50 is not clawed back, and the fixer still earns 100. Two different useful acts.
- **Dismissing a nudge sets `status = 'fixed'`.** The check constraint allows only
  `open | fixed | reported`; there is no `dismissed` value and v1 does not add one. On a
  `kind='nudge'` row, `fixed` means acknowledged.
- **No push transport in v1.** Pages are async Server Components; a mutation on one device cannot
  update another. The badge and inbox refresh **on navigation**. The pitch works with this (see the
  runbook's step 5, which navigates deliberately). If time allows in Phase 5, the cheapest upgrade
  is a single `"use client"` leaf on the authed layout calling `router.refresh()` on a ~5s interval;
  Supabase Realtime is the correct answer but is not a Phase 5 change.

### 7. Profile & Settings (`/profile`)
- User stats summary (total earned, total contributed, days active, trees tended).
- Edit username and re-upload profile avatar.
- Sign out button with instant session clearance.

### 8. Demo Rig & Stage Controls (`/demo`)
- Hidden route for judges/live pitch presentation.
- **Time-Travel**: Fast-forward to the next day (generates new readings, awards points, moves charts).
  **Must run last in the runbook** — it regenerates everyone's savings, which changes who counts as
  "not earning" and can silently invalidate the nudge target in step 2.
- **Trigger Waste Alert**: Raise a waste alert for **any group, at any location**, on demand — a
  group selector plus free-text location, with one-tap presets. Aiming it at whichever garden is on
  screen is the point; a hardcoded single alert cannot follow the demo.
- **Simulate Slacker**: Zero out a target user's savings so judges can watch a live nudge being sent and received.
- **Boost Group to a target you set**: drive a group's contributions to an exact figure (presets
  99 / 90 / 50%, or exact points). This is the control that **arms the unlock celebration** — park a
  group a few points short to rehearse the payoff, or drop it back to show the bar climb. The ledger
  is append-only, so a boost can only move a group **forward**; only a re-seed walks it back.
- **Pitch-state status panel**: a read-only readout at the top of `/demo` — SOC total and
  gap, demo wallet, open + reported alert counts, latest reading date, group vouchers already
  claimed. Every rehearsal permanently consumes state (the unlock beat, alert resolutions,
  redemptions), and this is the only thing that tells you so **before** you are on stage rather
  than during.
- **Access gate**: `/demo` is unlinked but fully reachable on the deployed URL, and it mints `earn`,
  raises alerts, and contributes on other users' behalf. It must `notFound()` for anyone who is not
  the demo account.
- **`/demo` must use the service-role client** (`createAdminClient()`), and it is the *only* route
  that may. RLS deliberately blocks exactly what the demo rig needs: the `ledger` insert policy
  permits only `kind in ('contribute','redeem')` (so a client cannot mint `earn`), the `events`
  insert policy permits only `kind='nudge'` (so a client cannot raise an `alert`), and `readings`
  has no client insert policy at all. Do **not** loosen these policies to make `/demo` work — see
  Standing Rule 4 in [IMPLEMENTATION.md](./IMPLEMENTATION.md).

---

## 7. 12-Hour Hackathon Execution Timeline

```
[Hour 0-2]  Phase 0: Database schema, RLS, seed script, design tokens & UI components (mostly done — see IMPLEMENTATION.md)
[Hour 2-4]  Phase 1: Login, onboarding, dashboard with multi-group trees & global leaderboard
            + FIRST DEPLOY (Vercel + env vars) — do not leave hosting until hour 11
[Hour 4-6]  Phase 2: Community garden 5x5 grid, username search, tree inspector & peer nudges
[Hour 6-8]  Phase 3: EcoVolt /energy page with 14-day CSS charts & points conversion calculator
[Hour 8-10] Phase 4: /vouchers rewards hub (personal voucher redemption & group goal unlock)
[Hour 10-11] Phase 4.5: /alerts notifications inbox & waste resolution flow
[Hour 11-12] Phase 5: /demo control room, pitch rehearsal, polish animations & stress testing
```

**This timeline has no slack** — the phases sum to exactly 12 of 12 hours. The first overrun eats
the pitch rehearsal. Cut these **first**, and decide it now rather than at hour 10:

| Cut order | Scope | Phase |
|:---:|---|---|
| 1 | ~~`/profile` stats grid~~ — **taken, as planned.** `/profile` shipped with avatar, username, community list and sign out only | 4.5 |
| 2 | `demoResetSeed()` — re-run `bun run seed` from a terminal instead | 5 |

Phases 3 and 4 landed without needing their cuts, so the two entries that used to head this list
**shipped**: the water telemetry panel on `/energy`, and the claimed-voucher history on `/vouchers`
(a plain list rather than a drawer, since the query is needed anyway to hide already-claimed group
quests). Cut 1 above **was** taken in Phase 4.5 — `/profile` has no stats grid — and that was the
right call: the tab exists, it no longer 404s, and the pitch never opens it.

So only `demoResetSeed()` is still on the table, and the 3-minute runbook in §8 does not touch it.

---

## 8. Presentation & Pitch Runbook (3-Minute Live Demo)

> **Every number below is produced by `bun run seed`, not hardcoded here.** The seed prints a
> per-group `gap` and a `Pitch unlock beat:` line that states the exact contribution amount and
> asserts the demo user's wallet covers it. **Re-run the seed and re-read those two numbers before
> every rehearsal and before the real pitch.** If the check ever prints `NO`, retune
> `DEMO_GROUP_FILL` / `DEMO_WALLET_RESERVE` in `scripts/seed.ts`. Values below are from the
> current seed configuration.

1. **0:00 - 0:30 (The Hook & Login)**: Log in as `tejas.sunil@u.nus.edu`. Show the Dashboard: explain that university residences waste massive energy because students don't see their impact. Introduce Evergreen: conservation as a shared garden.
2. **0:30 - 1:15 (Community Garden & 5×5 Grid)**: Open "SOC" garden (22 seeded members, so the grid reads full — 3 bare tiles of 25). Show the 5×5 plot where everyone's tree grows with their contributions. Search for peer `alice.tan`, inspect her tree, and send a leaf nudge because she didn't save yesterday. *(`alice.tan` is a seeded low-earner and a SOC member — verify both with the seed summary. `chloe.ng`, `ben.lim`, and `daniel.koh` are the other seeded nudge targets if a backup is needed.)*
3. **1:15 - 1:50 (EcoVolt Tracker & Points Engine)**: Navigate to `/energy`. Show real EcoVolt telemetry against baseline. Explain the $1\% = 10\text{ pts}$ formula.
4. **1:50 - 2:30 (The Unlock Moment)**: Open `/vouchers`. Show that SOC is at **~4,750 / 5,000** pts for Universal Studios tickets. Contribute the **~250 pt** gap from wallet $\rightarrow$ live animation triggers unlocking the group reward for all members. *(Demo user's wallet is ~1,280 pts, comfortably above the gap.)*
5. **2:30 - 3:00 (Live Anomaly, Proof, & Time Advance)**: On the secondary screen open `/demo` and
   raise a waste alert **against the group already on screen**, naming a real location in the room
   you are standing in. **Then tap the header bell on the main screen** to load it — there is no
   push transport, the main screen updates on navigation (see §6.6). Now show the evidence ladder,
   which is the beat that sells the mechanic:
   - **"I can't fix it, but here's proof"** $\rightarrow$ *Report* with a photo, **+50**. The alert
     **stays in the inbox in its half state** — reported is not resolved, and the community can see
     it is still broken.
   - **"I turned it off"** $\rightarrow$ *Fix* with a photo, **+100**, and the alert closes with
     your name and photo on it.
   Then advance time by 1 day and show every chart and leaderboard recalculating live.

   > **The photo is the riskiest interaction in the pitch.** `fixed` is rejected by the database
   > without one, so this step cannot be faked on the day. Rehearse it on the actual phone over the
   > actual venue wifi. Keep a suitable photo already in the camera roll as the fallback, and make
   > sure the file input is **not** locked to `capture="environment"` — on iOS that opens the camera
   > with no gallery option, removing the fallback entirely.
   >
   > If wifi or lighting fails you: a **bare report is +10 and needs no photo**. It is the safe
   > path, and it still demonstrates the ladder — just say the number out loud.

### Pre-Pitch Checklist

1. Apply the schema: **`bun run db:push`** (or paste `supabase/schema.sql` into the SQL editor).
   Do this **before** seeding — the seed reads columns that only exist once it has been applied,
   and since Phase 4.5 it also writes `events.resolved_by`, so an unmigrated database fails the
   seed outright.
   - *`db:push` runs `scripts/db-push.ts`, not the Supabase CLI. The CLI one-liner could not do this
     job on Windows: the `$SUPABASE_DB_URL` shell variable came through empty, and once passed
     explicitly the CLI sent the file as a single prepared statement, which Postgres rejects for
     multi-statement DDL.*
2. `bun run seed`. Confirm the `Pitch unlock beat:` line prints `YES`.
3. Copy the printed SOC total and gap into step 4 above.
4. Confirm the deployed URL is live on both the phone (main screen) and laptop (`/demo`), and that
   **`SUPABASE_SECRET_KEY` is set in the Vercel environment** — every `/demo` action reads it
   through `createAdminClient()`, and without it the whole rig fails on stage while working locally.
5. Open `/demo` and read the status panel. Every rehearsal permanently consumes state — the unlock
   beat, alert resolutions, redemptions — so confirm the gap, wallet, and alert counts are what
   step 4 and step 5 expect. If not, re-seed.
6. **Rehearse the photo upload on the real phone, over the venue wifi.** It is the only step that
   cannot be faked (the database rejects `fixed` without a photo) and the only one that depends on
   the network mid-pitch. Put a fallback photo in the camera roll.
7. Note the latest reading date. `/energy`'s banner shows it, and it shifts every time the seed is
   re-run on a new calendar day — do not quote a date from memory on stage.
