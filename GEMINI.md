# Evergreen — Agent Guidance for Gemini

Adhere strictly to project conventions defined across:
- [AGENTS.md](file:///c:/Users/tejas_uvx2fi9/DevStuff/nus/lifehack2026/AGENTS.md) — Comprehensive rules, commands, and conventions.
- [PLAN.md](file:///c:/Users/tejas_uvx2fi9/DevStuff/nus/lifehack2026/PLAN.md) — Product architecture, EcoVolt hardware integration, and feature specs.
- [IMPLEMENTATION.md](file:///c:/Users/tejas_uvx2fi9/DevStuff/nus/lifehack2026/IMPLEMENTATION.md) — Task-level implementation tracker and Core User Flow.
- [DESIGN.md](file:///c:/Users/tejas_uvx2fi9/DevStuff/nus/lifehack2026/DESIGN.md) — Design tokens, rhythm, and motion specifications.

## Key Developer Commands
```bash
bun run dev     # Start Next.js 16 development server
bun run seed    # Seed demo users, EcoVolt readings, ledger & alerts
bun run lint    # ESLint check
bun run build   # Production build verification
```

## Critical Architecture Principles
1. **Light Theme Only**: All colors use CSS variables defined in `src/app/globals.css` `@theme` block (`bg-background`, `bg-surface`, `bg-surface-muted`, `border-border`, `text-foreground`, `text-muted`, `text-primary`, `text-accent`, `text-warn`, `text-danger`).
2. **Next.js 16 Server Component Purity**: All route `page.tsx` files are async server components performing direct data queries with Supabase. Client interactivity or `motion/react` animations are isolated into small `"use client"` leaf components.
3. **Auth & Gatekeeping**: Call `requireProfile()` from `src/lib/supabase/server.ts` at the top of authed pages.
4. **Points & Ledger System**:
   - `earn`: Minted automatically from EcoVolt meter readings ($1\% \text{ reduction} = 10\text{ pts}$).
   - `contribute`: User invests wallet points into a specific group's tree and quest pool.
   - `redeem`: User spends wallet points to claim personal vouchers.
   - Tree growth stages: $[0, 50, 150, 400, 800, 1500]$ points mapped to 6 SVG visual stages.
5. **Mobile-First**: Layout is constrained to a single `max-w-md` column in `src/app/layout.tsx`.
