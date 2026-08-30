# 🌱 Evergreen

**Conservation as a shared garden.** A mobile-first web app that turns the electricity and water your
building actually uses into a living communal garden — built for LifeHack 2026 on Next.js 16 and
Supabase, powered by [EcoVolt](https://www.ecovolt.ai/) smart meters.

Save power → earn points → your tree grows → give points to your community's garden → the group
crosses a threshold → **everyone** gets the reward.

---

## Getting Started

### Prerequisites

- [**Bun**](https://bun.sh) 1.3+ (the package manager and script runner — `package.json` pins `bun@1.3.14`)
- A **Supabase** project (free tier is fine)

### 1. Install

```bash
bun install
```

### 2. Configure environment

Copy the example and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

| Variable                               | Where to find it                                             | Used by                                                    |
| -------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Project Settings → Data API                                  | Browser + server                                           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys                                  | Browser + server                                           |
| `SUPABASE_SECRET_KEY`                  | Project Settings → API Keys (secret)                         | `bun run seed` only — **never** prefix with `NEXT_PUBLIC_` |
| `SUPABASE_DB_URL`                      | Settings → Database → Connection string → **Session pooler** | `bun run db:push` only                                     |

> **Use port `6543`, not `5432`, in `SUPABASE_DB_URL`.** Port 5432 is blocked on many campus and
> office networks — including NUS wifi, which is where we found out. Percent-encode any special
> characters in the password.

### 3. Apply the database schema

```bash
bun run db:push
```

Creates all 8 tables, every Row Level Security policy, the storage bucket, the `resolve_alert`
Postgres function, and the starter voucher catalogue. The file is **idempotent** — re-running it is
safe, and you must re-run it before any fresh seed.

_(No `SUPABASE_DB_URL`? Paste `supabase/schema.sql` into the Supabase SQL editor instead.)_

### 4. Seed demo data

```bash
bun run seed
```

Deterministic (fixed-seed PRNG, so every run produces identical data). Creates 22 accounts, 3
communities, 21 days of energy and water telemetry, the points ledger, and sample alerts. It prints a
summary — including the shared password for every seeded account.

### 5. Run

```bash
bun run dev
```

Open **http://localhost:3000**. The app is designed strictly for **mobile viewports** — use your
browser's device toolbar, or open it on your phone.

### Demo accounts

Every seeded account shares the password **`12345678`**. Start with the first one — it's the only
account that belongs to two communities, so it's the one that shows the multi-group experience.

| Email                   | Username    | Communities              |
| ----------------------- | ----------- | ------------------------ |
| `tejas.sunil@u.nus.edu` | tejasbuilds | 💻 SOC + 🏛️ Raffles Hall |
| `sairathomas@u.nus.edu` | Ecofriend   | 💻 SOC + 🏛️ Raffles Hall |
| `ziern_teh@u.nus.edu`   | ziern_teh   | 💻 SOC + 🎓 NUSC         |
| `vayuntandon@u.nus.edu` | vayun       | 💻 SOC                   |

Another 18 seeded residents fill out the gardens and the leaderboard — `alice.tan@u.nus.edu`,
`ben.lim@u.nus.edu`, `chloe.ng@u.nus.edu`, `daniel.koh@u.nus.edu`, `elena.wu@u.nus.edu`,
`farhan.i@u.nus.edu`, `grace.ho@u.nus.edu`, `hui.min@u.nus.edu`, `ivan.chen@u.nus.edu`,
`jia.ying@u.nus.edu`, `kavya.r@u.nus.edu`, `liang.zw@u.nus.edu`, `mei.ling@u.nus.edu`,
`noah.p@u.nus.edu`, `olivia.s@u.nus.edu`, `priya.nair@u.nus.edu`, `qi.xuan@u.nus.edu`,
`ryan.teo@u.nus.edu` — same password. Log in as one of them to see the app from the other side of a
nudge.

> These are throwaway accounts on a seeded demo database. If you point this at a real project,
> re-seed with your own credentials.

### Why there's no "Sign up" button

**Accounts are issued by the organization, not self-registered — and that's the product, not a
missing feature.**

An Evergreen account only means something once it is bound to a physical EcoVolt meter. Your points
come from _your_ consumption measured against _your_ enrolment baseline, and your community is the
floor or college you actually live in. A self-registered account has none of that: no meter, no
baseline, no location, nothing to measure and nothing to be jointly responsible for. It could not
earn a single point, and dropping it into a hall's garden would put a stranger's tree on a plot next
to people who share a corridor.

So the flow runs the other way round. A facility manager commissions the meters, creates the
accounts against institutional email addresses (`@u.nus.edu`), and assigns each one to the
location it belongs to. The app deliberately has **no `insert` grant on `profiles` and no
auto-provision trigger** — a login with no organization-created profile is rejected with
_"No profile row for this account"_ rather than being quietly handed an empty dashboard.

What the user controls is their **public identity**, not their data source: on first login they pick
a username and upload an avatar. Group membership is never user-selected.

_(In this prototype the "organization" is `scripts/seed.ts` — it creates the accounts, assigns the
communities, and generates the meter readings that a real EcoVolt deployment would stream in.)_

### Scripts

| Command           | What it does                                |
| ----------------- | ------------------------------------------- |
| `bun run dev`     | Development server                          |
| `bun run build`   | Production build                            |
| `bun run lint`    | ESLint                                      |
| `bun run db:push` | Apply `supabase/schema.sql` to your project |
| `bun run seed`    | Wipe and rebuild all generated data         |

---

## Inspiration

We live in NUS halls and colleges, and every one of them has the same problem: the common-room lights
burn all night, someone's aircon runs against an open window, and **nobody feels responsible** —
because nobody can see it. The electricity bill is one number, once a month, addressed to the
institution. Awareness posters ask you to care about a quantity you have never been shown.

Meanwhile EcoVolt meters are already measuring all of it, per room, every day. The data exists (Maybe not in NUS right now but its there in others). What doesn't exist is a reason to look at it.

So we stopped designing a dashboard and started designing a **garden**. You don't check your energy
usage; you check on your tree — and everyone in your hall can see whether it's growing.

## What it does

Evergreen turns each EcoVolt-enabled location into a **Community** — a hall floor, a college, a
school. Reduce your consumption below your enrolment baseline and you earn points daily: **1% saved =
10 points**. Points are fertilizer. Spend them on yourself, or plant them in your community's garden
so everyone benefits.

**The pages:**

| Screen                    | What's there                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Home** `/`              | Your wallet balance, a mini-tree for every community you're in, a 7-day energy chart against your baseline, monthly impact (kWh, litres, CO₂), and the global leaderboard with your rank                                                                                                                                                   |
| **Garden** `/garden/[id]` | An **isometric 5×5 plot** — not a grid of boxes — where every member's tree stands at its true growth stage, so height alone shows who's contributing. Search a username to find their plot, tap any plot to inspect that member, and send a leaf nudge to anyone who didn't save yesterday. Members over their usual usage light up amber |
| **Energy** `/energy`      | Your EcoVolt meter: 14 days of electricity and water against the frozen baseline, a day-by-day breakdown of exactly how each percent became points, and the conversion explained                                                                                                                                                           |
| **Rewards** `/vouchers`   | Redeem personal treats (bubble tea, GrabFood, Kopitiam) for an 8-character code, or contribute points to your community's quest. Cross the group goal and the reward unlocks **for every member**                                                                                                                                          |
| **Alerts** 🔔             | Community waste reports and peer nudges. Resolving an alert pays out on an **evidence-first ladder**: a photo proving you turned it off earns 100, a photo proving it's still broken earns 50, a bare report earns 10                                                                                                                      |
| **Profile** `/profile`    | Avatar, username, your communities, sign out                                                                                                                                                                                                                                                                                               |

Three design decisions do most of the work:

- **Your tree grows from what you _give_, not what you earn.** Hoarding points grows nothing. The
  garden is the scoreboard, and it's communal.
- **Group rewards are a threshold, not a purchase.** Contributed points are never consumed by an
  unlock — they stay as tree growth forever, which is why the garden never shrinks.
- **Accounts are issued by the organization and bound to a meter.** There is no sign-up button. A
  facility manager commissions the EcoVolt meters, creates accounts against institutional emails and
  assigns each to the floor or college it belongs to — because an account with no meter has no
  baseline, can earn nothing, and has no business standing in someone else's garden. See
  [Why there's no "Sign up" button](#why-theres-no-sign-up-button).

## How we built it

**Next.js 16 (App Router) + React 19 + Supabase + Tailwind v4**, TypeScript strict throughout, on
Bun. **Seven runtime dependencies total** — no chart library, no game engine, no component kit.

- **Server Components fetch, client leaves interact.** Every `page.tsx` is an `async` Server
  Component reading Postgres directly through RLS; anything stateful is a small `"use client"` leaf.
- **One immutable ledger is the single source of truth.** Points are never a mutable column on a user
  row. Wallet = `Σearn − Σcontribute − Σredeem`, leaderboard = `Σearn`, a tree = `Σcontribute` for
  that group. Every number on every screen reconciles to the same table.
- **RLS on all 8 tables.** Clients can insert `contribute` and `redeem` — never `earn`. The one
  client-reachable path that mints points (resolving a waste alert) runs inside a `security definer`
  Postgres function that owns the payout table, so a crafted request can't name its own number.
- **The baseline is frozen at enrolment, not rolling.** This is deliberate: a rolling baseline
  recomputed from your own recent usage means sustained saving lowers the bar and drives earnings to
  zero — the better you behave, the less you earn, and the mechanic extinguishes itself.
- **"Field Notes" design system.** One monospace face, 14 colour tokens, flat fills, no gradients or
  shadows anywhere. Every tree, tile and chart is hand-drawn SVG or CSS.
- **Deterministic seeding.** A mulberry32 PRNG means the demo data is byte-identical on every run,
  and the seed script _asserts_ the demo is actually winnable before we walk on stage.

## Challenges we ran into

- **Campus wifi blocks Postgres.** Port 5432 is firewalled on NUS wifi, so the Supabase CLI hung
  forever at `Initialising login role...`. Switching to the pooler on 6543 fixed connectivity — but
  the CLI then sent our schema as a single prepared statement, which Postgres rejects for
  multi-statement DDL. We wrote our own `scripts/db-push.ts`.
- **The animation library silently rewrote our CSS.** Trees on the left and right of the isometric
  plot slid sideways when selected, while the middle column looked fine. `motion` forces
  `transform-box: fill-box` on SVG elements when you animate a transform, so our absolute
  `transform-origin` coordinates were being measured from _each tree's own bounding box_ — an error
  proportional to distance from centre. Percentage origins fixed it.
- **Our chart was 1.88× too big on a phone.** The bar chart was an SVG with a `168×105` viewBox
  stretched by `w-full` to ~316px, scaling everything inside it — including `fontSize={8}`, which
  landed at ~15px against a type scale whose labels are 11.5px. And the factor changed with screen
  width, so no fixed font size could be correct. We rebuilt it in CSS: bars flex, text is just text.
- **Paying points for a good deed, without opening a security hole.** RLS deliberately forbids
  clients from minting `earn`, and we refused to loosen it or reach for the service-role key in a
  user-facing route. The answer was a `security definer` function that both awards the points and
  claims the alert atomically (`where status = 'open'`), so two people tapping at once can't both
  be paid.
- **Silent seeding bugs.** A user sat 3rd on the leaderboard with a **blank name** — profiles were
  upserted with `ignoreDuplicates`, so a row that already existed with a `NULL` username could never
  be repaired by re-seeding. Separately, `group_memberships` is a composite primary key with no `id`
  column, so it quietly escaped our wipe routine and stale memberships survived every reseed.

## Accomplishments that we're proud of

- **The garden actually reads as a garden.** A 5×5 isometric plot in 2:1 projection, 25 tiles, every
  member's tree at its true height, drawn by hand in SVG with no game engine and no dependencies.
  Height alone tells you who's pulling their weight — that's the whole social mechanic in one glance.
- **Every number reconciles.** We hand-checked the wallet, each tree stage and the leaderboard rank
  against raw `ledger` queries. One immutable table drives all of it, on every screen.
- **The alert payout is safer than it had to be.** The evidence ladder lives in Postgres, not the
  client, and the first-responder claim is genuinely atomic.
- **We held the design system.** Seven screens, 14 colours, one typeface, zero gradients and zero
  shadows — and it still doesn't look like a template.
- **A seed that checks its own work.** It prints the exact contribution needed to unlock the group
  reward and asserts the demo wallet covers it, so a failed rehearsal is caught in a terminal
  instead of in front of judges.

## What we learned

- **Push enforcement into the database.** Everything we moved into RLS or a `security definer`
  function stopped being a thing we had to remember. We can point at exactly where we didn't do this
  — contributing and redeeming validate the balance in a Server Action, which is a read-then-write
  race and a UX guard, not a security boundary.
- **Libraries change properties you didn't set.** The `transform-box` bug cost us real time and was
  invisible until we read `motion`'s source.
- **Anything authored inside a stretched SVG scales its own text.** A viewBox is a zoom factor for
  everything in it, fonts included.
- **Incentive design can quietly destroy itself.** The rolling-baseline trap — save more, earn less —
  looks reasonable until you follow it two weeks forward.
- **Measure on a phone, not a desktop column.** We caught the oversized chart only after measuring
  real rendered pixels at a 390px width.

## What's next for Evergreen

- **Water as a real currency.** It's captured and charted today but earns nothing — it needs its own
  baseline integrity story before it can mint points.
- **Close the overdraft gap.** Move `contribute` and `redeem` into a single `security definer`
  function that checks balance and membership atomically, then drop the direct insert policy so the
  database is the only enforcement point.
- **Realtime.** There's no push transport yet — the alert badge refreshes on navigation. Supabase
  Realtime is the right answer.
- **More game feel.** A celebration when a community crosses its goal, counting-up numbers, and a
  proper reward-reveal moment.
- **Multi-quest chains** so a community that hits its goal immediately has a next one.
- **Evidence review**, because v1 trusts the photo and a photo is easy to fake.
