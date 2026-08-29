<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Evergreen project conventions

## Commands

- Dev server: `bun run dev`
- Seed database: `bun run seed`
- Typecheck/Lint: `bun run lint`
- Production build: `bun run build`

## Frontend & Styling

- **Light theme only** — no dark mode variant anywhere. Colors live as CSS custom properties in `src/app/globals.css` `@theme` block; use the token utilities (`bg-background`, `bg-surface`, `bg-surface-muted`, `border-border`, `text-primary`, `text-muted`, `text-flag`, `bg-plot`, `bg-plot-hot`, `fill-canopy`, `fill-canopy-deep`, `stroke-bark`, `bg-panel`). There is no `accent`, `warn`, or `danger` token — amber is `plot-hot`, red is `flag`. Never hardcode hex colors or default Tailwind `zinc-*`/`lime-*` classes. See `DESIGN.md` for the full table.
- **Field Notes visual system** — the whole interface is set in one monospace face (JetBrains Mono, loaded once in `src/app/layout.tsx`; `font-sans` and `font-mono` resolve to the same family on purpose). Flat fills only: **no gradients and no shadows anywhere**, and no opacity ramps in artwork — a lighter green is `canopy`, a darker one is `canopy-deep`. Card radius tops out at `rounded-2xl`.
- **Mobile-first**: The app is rendered in a single `max-w-md` container (`src/app/layout.tsx`). Design strictly for mobile viewports.
- **Shared UI**: Use `src/components/ui/` (`Card`, `Button`, `StatCard`, `ProgressBar`, `Avatar`) and `src/components/nav/` (`BottomNav`).
- **Animation**: Use `motion` (`motion/react`), not raw CSS transitions, for tap feedback (`whileTap`), progress fills, and count-ups.
- **Server Components vs Client Leaves**: Pages under `src/app/**/page.tsx` are `async` server components — keep them that way. Components utilizing `motion`, event handlers, or React hooks must be small `"use client"` leaf components rendered by the server page.
- **Icons**: `lucide-react` for all UI iconography (nav, buttons, stats). Emoji is strictly reserved for database data values (e.g. group `emoji`, voucher `emoji`).

## Backend & Supabase

- `requireProfile()` in `src/lib/supabase/server.ts` is the auth + onboarding gate. Call it at the top of any authed page; it redirects to `/login` or `/onboarding` as needed and returns `{ supabase, user, profile, groups }`.
- **Database Schema**: All changes go into `supabase/schema.sql`, kept idempotent (`create table if not exists`, `drop policy if exists` + recreate).
- **Row Level Security (RLS)**: Enabled on all tables. Any table query or mutation must satisfy RLS policies.
- **Immutable Ledger**: User points are never mutated directly on profile rows. Points are derived from the `ledger` table (`kind: 'earn' | 'contribute' | 'redeem'`).
  - Wallet balance = $\sum \text{earn} - \sum \text{contribute} - \sum \text{redeem}$.
  - Tree growth per group = $\sum \text{contribute}$ for that `group_id`.
  - Global leaderboard = $\sum \text{earn}$.

## Math & Points Mechanics (`src/lib/points.ts`)

- **Energy-to-Points**: $1\%$ reduction below baseline $= 10\text{ points/day}$ (floored at 0 via `earnFor(baseline, actual)`).
- **Tree Stages**: 6 stages ($0 - 5$) evaluated via `treeStage(contributed)`: Seed (0), Sprout (50), Sapling (150), Young Tree (400), Mature Tree (800), Blossoming (1500).
