# Plan (post-reset)

Restarting the app — name, UI, styling, and feature code all get thrown away.
Keeping: the stack, the Supabase project/schema, and the login flow.

## Stack to keep

- Next.js 16 (App Router), React 19, TypeScript, bun as package manager
- Tailwind CSS v4 (via `@tailwindcss/postcss`)
- `@supabase/supabase-js` + `@supabase/ssr` for auth/DB
- `lucide-react` for icons, `motion` for animation

## Supabase setup to keep

Schema lives in `supabase/schema.sql`, run in the Supabase SQL editor, idempotent
(safe to re-run: `create table if not exists`, `drop policy if exists` + recreate).

- `public.groups` — id, name (unique), emoji
- `public.profiles` — id (= `auth.users.id`), username (unique, 3-20 chars),
  avatar_url, group_id (FK to groups)
- RLS enabled on both tables; authenticated users can read groups/profiles and
  update only their own profile row
- A `lock_group` trigger blocks users from editing their own `group_id` via
  the update policy (RLS alone can't restrict to a subset of columns)
- `avatars` storage bucket (public), users can only write into a folder named
  after their own uid

`src/lib/supabase/client.ts` and `server.ts` wrap `createServerClient`/browser
client. `requireProfile()` in `server.ts` is the auth+onboarding gate: no user
→ redirect `/login`; user with no username yet → redirect `/onboarding`;
otherwise returns `{ supabase, user, profile, group }`.

## Login flow to keep

Email + password via `supabase.auth.signInWithPassword` (`src/app/login/page.tsx`),
client component, redirects to `/` on success. First-time users without a
username get bounced to `/onboarding` to set one (onboarding writes to
`profiles`, group is assigned server-side/seeded, not user-chosen).

## Everything else — reset

App name, all page content/copy, color tokens, component styles, layout
shape, nav — all up for a redo.
