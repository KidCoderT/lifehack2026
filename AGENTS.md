<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Sprout project conventions

## Frontend

- Light theme only — no dark mode variant anywhere. Colors live as CSS
  custom properties in `src/app/globals.css`'s `@theme` block; use the
  token utilities (`bg-background`, `text-primary`, `text-muted`, etc.),
  don't hardcode hex or `zinc-*`/`lime-*` Tailwind defaults in new code.
  See `DESIGN.md` for the full token/component spec.
- Shared UI lives in `src/components/ui/` (`Card`, `Button`, `StatCard`)
  and `src/components/nav/` (`BottomNav`). Check there before inlining a
  new card/button style a third time.
- Animation: use the `motion` package (`motion/react`), not raw CSS
  transitions, for tap feedback, progress fills, and count-ups. Pages
  under `src/app/**/page.tsx` are `async` server components — keep them
  that way. Anything using `motion` (`whileTap`, animated values) belongs
  in a small `"use client"` leaf component the server page renders with
  plain props; don't convert a whole page to a client component just to
  animate one part of it.
- Icons: `lucide-react` for all UI iconography (nav, buttons, stat rows).
  Emoji stays only where it's actual data from the database (e.g. a
  group's `emoji` column) — never as a stand-in for a UI icon.
- Mobile-first: the app is a single `max-w-md` column
  (`src/app/layout.tsx`). Don't design for wide viewports; this isn't a
  responsive multi-column app.

## Backend / Supabase

- `requireProfile()` in `src/lib/supabase/server.ts` is the auth +
  onboarding gate. Call it at the top of any authed page; it redirects to
  `/login` or `/onboarding` as needed and returns
  `{ supabase, user, profile, group }`. Don't re-implement the gate —
  reuse it.
- Schema changes go in `supabase/schema.sql` only, kept idempotent
  (`create table if not exists`, `drop policy if exists` + recreate).
  Never hand-edit via the dashboard without also updating this file.
- No generated DB types exist yet — untyped embeds from `.select()` need a
  manual cast; keep those casts contained to `requireProfile()` rather than
  repeating them per-page. Once a third untyped embed shows up, run
  `bunx supabase gen types typescript --linked` instead.
- RLS is on for every table — a new table needs
  `enable row level security` plus explicit `select`/`update`/etc.
  policies in the same schema.sql change, or authenticated reads/writes
  will silently return nothing.
