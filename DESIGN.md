# Sprout — Design System

Sprout is a mobile-first, gamified sustainability app: track electricity,
water, and other resource use, earn progress with your group, keep a streak
going. It should feel playful and rewarding — nice motion, clean surfaces —
without ever pretending to have data it doesn't.

## Visual identity

**Clean eco-modern reskin.** The layout ideas in this doc are inspired by a
mock ("PhantomGrid") — bottom tab nav, stat cards with a big number, a
crew/group card, ranked lists, a collectible badge grid. We borrow that
**layout grammar only**. None of its dark, pixel-art, monster-collecting
visual language carries over: Sprout is light-themed, uses simple modern
shapes and `lucide-react` line icons, and shows real sustainability data —
not fantasy creatures. There is no dark mode; light is the only theme.

## Color tokens

Defined as Tailwind v4 `@theme` CSS variables in `src/app/globals.css`,
which auto-generate the matching utility classes (`bg-primary`,
`text-muted`, `border-border`, etc.):

| Token | Value | Use |
|---|---|---|
| `--color-background` | `#f6faf7` | App canvas |
| `--color-surface` | `#ffffff` | Cards |
| `--color-surface-muted` | `#eef5f0` | Recessed panels, disabled nav items |
| `--color-border` | `#dbe7de` | Hairlines |
| `--color-foreground` | `#14261c` | Primary text |
| `--color-muted` | `#5b6f63` | Secondary text |
| `--color-primary` | `#16a34a` | Buttons, active states, group card |
| `--color-primary-foreground` | `#ffffff` | Text on primary |
| `--color-accent` | `#0ea5b0` | Secondary accent (water), links |
| `--color-warn` | `#d97706` | Streak/energy warmth (not destructive) |
| `--color-danger` | `#dc2626` | Errors only |

Don't hardcode hex values or Tailwind's default `zinc-*`/`lime-*` palettes in
new code — use these tokens so a future palette tweak is a one-file change.

## Typography, spacing, radius

- **Font**: Geist Sans for text, Geist Mono for numeric stat displays
  (already loaded via `next/font/google`, no new fonts).
- **Type scale**: `text-xs` captions, `text-sm` secondary text, `text-base`
  body, `text-xl`/`text-2xl` headings, `text-3xl`/`text-4xl` big stat
  numbers (mono).
- **Page rhythm**: `px-6 py-10` page padding, `p-6` card padding, `gap-6`
  between stacked sections.
- **Radius**: Tailwind's built-in scale — `rounded-2xl` for inputs,
  `rounded-3xl` for cards, `rounded-full` for pills/avatars/nav icons. No
  custom radius tokens needed; the default v4 scale already covers this.

## Components

### Built today (`src/components/`)

- **`ui/card.tsx`** — base surface: `rounded-3xl border border-border
  bg-surface p-6`. Hero variant (used for the group card) swaps in a
  `from-primary to-accent` gradient with `text-primary-foreground`.
- **`ui/button.tsx`** — `primary` (filled green), `secondary` (muted
  surface), `ghost` (transparent). Client component wrapping `motion.button`
  for tap feedback.
- **`ui/stat-card.tsx`** — label + big mono number + optional caption + a
  `lucide-react` icon. Static for now (no time-series data to sparkline).
- **`nav/bottom-nav.tsx`** — 5 tabs. Home and Profile are live links; Crew,
  Vault, and Ranks render as real disabled elements (not dead links) until
  their data models exist.
- **`motion/fade-in.tsx`** — the one shared entrance-animation wrapper.

### Documented, not built (need a data model first)

- **Badge** — collectible/achievement pill, for a future Vault page.
- **ProgressBar** — shared team-goal progress, for a future Crew page.
- **Crew screen** — member avatar row, active team pact card, contribution
  log. Needs group-membership + shared-goal tables.
- **Vault screen** — points/currency counter, badge grid, "forge" progress.
  Needs a points/badges schema.
- **Leaderboard screen** — ranked list with rank-delta badges. Needs a
  scoring/points schema and a ranking query.

## Animation (`motion` package)

Import from `motion/react`. One rule matters more than any specific effect:

**Pages stay server components.** `src/app/**/page.tsx` files are `async`
functions that call `requireProfile()` and pass plain data down. Anything
using `motion` lives in a small `"use client"` leaf component (`FadeIn`,
`Button`) — never convert a whole page to a client component just to animate
part of it.

What gets animated, and nothing else:
- Button/card tap feedback: `whileTap={{ scale: 0.97 }}`.
- A single subtle entrance fade per page section (`FadeIn`): opacity + 8px
  rise, 300ms. No per-item stagger cascades.
- (Future, once real data exists) progress-bar fills and stat count-ups.

No page-transition system — not justified for two pages.

## Pages

- **Home (`/`)** — built. Greeting (avatar + username, real), group card
  (real), one honest placeholder card for the future daily-challenge/streak
  feature.
- **Profile (`/profile`)** — built. Avatar, username, group (read-only —
  `group_id` is DB-locked, no edit UI), sign out.
- **Crew / Vault / Leaderboard** — documented above, not built.
- **Login / Onboarding** — **out of scope for this pass, still dark-themed.**
  Follow-up needed so the app doesn't ship half-dark/half-light.

## Known follow-ups (explicitly deferred, not forgotten)

- Restyle `login/` and `onboarding/` to the light theme.
- Profile page is read-only today. Editing avatar/username by reusing
  `onboarding/form.tsx`'s `ProfileForm` needs two things first: parameterize
  `ProfileForm` with `redirectTo`/`submitLabel` props, and fix
  `onboarding/page.tsx`'s "already has a username → redirect to `/`" guard,
  which currently makes `/onboarding` unusable as an edit screen.
- Once real usage/streak/points data exists, replace the home page's
  placeholder card with real `StatCard`s and build Crew/Vault/Leaderboard.
- Once a third untyped Supabase embed shows up, run
  `bunx supabase gen types typescript --linked` instead of hand-casting.
