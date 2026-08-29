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
- Facility managers / organization administrators configure physical locations (e.g., "Solar Squad" = Sheares Hall Block A Level 3).
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
8. **`events`**: Social activity log (`id`, `kind` ∈ {nudge, alert}, `group_id`, `from_user`, `to_user`, `message`, `status` ∈ {open, fixed, reported}, `created_at`).

### Points Mathematics & Ledger Balances

$$\text{Daily Energy Reduction \%} = \max\left(0, \text{round}\left(\left(1 - \frac{\text{Actual kWh}}{\text{Baseline kWh}}\right) \times 100\right)\right)$$

$$\text{Earned Points} = \text{Daily Energy Reduction \%} \times 10$$

- **Global Leaderboard Rank**: Derived from $\sum \text{points}$ where `kind = 'earn'`.
- **User Wallet Balance**: $\sum \text{earn} - \sum \text{contribute} - \sum \text{redeem}$.
- **User Tree Growth in Group $G$**: Governed by $\sum \text{points}$ where `kind = 'contribute'` and `group_id = G`.
- **Community Quest Progress**: $\frac{\sum_{m \in G} \text{contributions}_m}{\text{group.goal\_points}} \times 100\%$.

**Points are minted from energy only.** Water readings are captured, charted on `/energy`, and
count toward the conservation narrative, but **they earn zero points in v1** — `earnFor()` in
`src/lib/points.ts` takes energy baseline/actual and nothing else. This is a scope decision, not an
oversight: a second currency needs its own baseline integrity story and doubles the balancing work.
Water is **display-only in v1**; the natural v2 is a separate water multiplier feeding the same
ledger. Say this out loud if asked — "Tide Turners" is a group name, not a second economy.

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
- **Energy Trend & Monthly Impact**: 7-day SVG bar chart with baseline comparison, plus weekly $\pm\%$ improvement metrics.
- **Global Leaderboard**: All-time top energy savers ranked by total earned points, highlighting the logged-in user's national rank.

### 3. Community Garden (`/garden/[groupId]`, `/garden`)
- **Top Quest Banner**: Communal goal progress bar (e.g., "$3,450 / 5,000\text{ pts}$ to unlock Universal Studios discount").
- **5×5 Garden Matrix Grid**: Interactive grid displaying all members' trees rendered at their exact individual growth stage.
- **Search & Filter**: Real-time username search to instantly focus and locate a peer's plot.
- **Tree Inspector Popover / Card**: Tap any tree or search result to inspect member stats (avatar, username, points contributed, current stage).
- **Social Nudge**: One-tap "Send Leaf Nudge" button on peers who have zero savings logged yesterday.

### 4. EcoVolt Energy Tracker (`/energy`)
- **EcoVolt Integration Header**: Hardware device status indicator (Online, 230V / 50Hz).
- **14-Day Energy Consumption Chart**: Interactive SVG bar graph comparing daily actual consumption against the dashed enrolment baseline (frozen per user — see §3).
- **Savings-to-Points Calculator**: Clear conversion formula display demonstrating $1\% = 10\text{ pts}$.
- **Water Consumption Panel**: Daily water volume tracking (Liters vs baseline) to monitor holistic resource efficiency.

### 5. Rewards & Vouchers (`/vouchers`)
- **Personal Vouchers**: Catalog of redeemable rewards (e.g., LiHO Bubble Tea, GrabFood $5, Kopitiam credit). Redeeming checks wallet balance, inserts a `redeem` ledger entry, and mints an 8-character redemption code.
- **Community Contribution Pool**: Interactive point allocation card allowing users to transfer wallet points into their community's tree fund.
- **Group Vouchers**: High-value collective perks (Universal Studios tickets, Escape room night) that unlock automatically for all members once the group goal is achieved.

### 6. Social Alerts & Inbox (`/alerts`)
- **Community Waste Broadcasts**: Alerts raised when energy anomalies or waste occur (e.g., "Lights left on in Common Room Level 3").
- **Interactive Action Buttons**: "Mark Fixed" (resolves for community) and "Report".
- **Peer Nudges Inbox**: Incoming leaf nudges received from community peers with dismiss functionality.
- **Unread definition**: there is no `read_at` column. **Unread = `events.status = 'open'`** for
  alerts in the user's groups plus nudges addressed to them. Acting on an item is what clears it.
  - "Mark Fixed" $\rightarrow$ `status = 'fixed'`. "Report" $\rightarrow$ `status = 'reported'`.
  - **Dismissing a nudge also sets `status = 'fixed'`.** The `status` check constraint allows only
    `open | fixed | reported`; there is no `dismissed` value and v1 does not add one. `fixed` on a
    `kind='nudge'` row means acknowledged.
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
- **Trigger Waste Alert**: Instantly broadcast a simulated energy spike to test the alerts flow.
- **Simulate Slacker**: Zero out a target user's savings so judges can watch a live nudge being sent and received.
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
[Hour 6-8]  Phase 3: EcoVolt /energy page with 14-day SVG charts & points conversion calculator
[Hour 8-10] Phase 4: /vouchers rewards hub (personal voucher redemption & group goal unlock)
[Hour 10-11] Phase 4.5: /alerts notifications inbox & waste resolution flow
[Hour 11-12] Phase 5: /demo control room, pitch rehearsal, polish animations & stress testing
```

**This timeline has no slack** — the phases sum to exactly 12 of 12 hours. The first overrun eats
the pitch rehearsal. Cut these **first**, and decide it now rather than at hour 10:

| Cut order | Scope | Phase |
|:---:|---|---|
| 1 | Water telemetry panel on `/energy` (water earns no points — see §5) | 3 |
| 2 | "My Active Vouchers" drawer + copy-code action | 4 |
| 3 | `/profile` stats grid (keep username edit + sign out) | 4.5 |
| 4 | `demoResetSeed()` — re-run `bun run seed` from a terminal instead | 5 |

The 3-minute pitch runbook in §8 does not touch any of the four.

---

## 8. Presentation & Pitch Runbook (3-Minute Live Demo)

> **Every number below is produced by `bun run seed`, not hardcoded here.** The seed prints a
> per-group `gap` and a `Pitch unlock beat:` line that states the exact contribution amount and
> asserts the demo user's wallet covers it. **Re-run the seed and re-read those two numbers before
> every rehearsal and before the real pitch.** If the check ever prints `NO`, retune
> `DEMO_GROUP_FILL` / `DEMO_WALLET_RESERVE` in `scripts/seed.ts`. Values below are from the
> current seed configuration.

1. **0:00 - 0:30 (The Hook & Login)**: Log in as `tejas.sunil@u.nus.edu`. Show the Dashboard: explain that university residences waste massive energy because students don't see their impact. Introduce Evergreen: conservation as a shared garden.
2. **0:30 - 1:15 (Community Garden & 5×5 Grid)**: Open "Solar Squad" garden (20 seeded members, so the grid reads full). Show the 5×5 plot where everyone's tree grows with their contributions. Search for peer `alice.tan`, inspect her tree, and send a leaf nudge because she didn't save yesterday. *(`alice.tan` is a seeded low-earner and a Solar Squad member — verify both with the seed summary. `chloe.ng`, `ben.lim`, and `daniel.koh` are the other seeded nudge targets if a backup is needed.)*
3. **1:15 - 1:50 (EcoVolt Tracker & Points Engine)**: Navigate to `/energy`. Show real EcoVolt telemetry against baseline. Explain the $1\% = 10\text{ pts}$ formula.
4. **1:50 - 2:30 (The Unlock Moment)**: Open `/vouchers`. Show that Solar Squad is at **~4,750 / 5,000** pts for Universal Studios tickets. Contribute the **~250 pt** gap from wallet $\rightarrow$ live animation triggers unlocking the group reward for all members. *(Demo user's wallet is ~1,280 pts, comfortably above the gap.)*
5. **2:30 - 3:00 (Live Anomaly & Time Advance)**: Open `/demo` on secondary screen: trigger a "Lights left on" alert. **Then tap the header bell on the main screen** to load the alert and resolve it with "Mark Fixed" — see §9, there is no push transport, the main screen updates on navigation. Advance time by 1 day and show all charts and leaderboards recalculating live.

### Pre-Pitch Checklist

1. Apply `supabase/schema.sql` in the Supabase SQL editor **before** seeding — the seed reads
   columns (`groups.goal_points`, `goal_title`) that only exist once the schema has been applied.
2. `bun run seed`. Confirm the `Pitch unlock beat:` line prints `YES`.
3. Copy the printed Solar Squad total and gap into step 4 above.
4. Confirm the deployed URL is live on both the phone (main screen) and laptop (`/demo`).
