# Evergreen — Agent Guidance for Claude

Read and adhere strictly to:
- [AGENTS.md](file:///c:/Users/tejas_uvx2fi9/DevStuff/nus/lifehack2026/AGENTS.md) — Core project rules, Next.js 16 conventions, and styling tokens.
- [PLAN.md](file:///c:/Users/tejas_uvx2fi9/DevStuff/nus/lifehack2026/PLAN.md) — Full product specification, EcoVolt integration model, and hackathon judging alignment.
- [IMPLEMENTATION.md](file:///c:/Users/tejas_uvx2fi9/DevStuff/nus/lifehack2026/IMPLEMENTATION.md) — Live phase-by-phase implementation plan, task checklist, and progress status.
- [DESIGN.md](file:///c:/Users/tejas_uvx2fi9/DevStuff/nus/lifehack2026/DESIGN.md) — UI tokens and animation guidelines.

## Quick Rules
1. **Light Theme Only**: Use tokens (`bg-background`, `text-primary`, `border-border`, etc.) from `src/app/globals.css`. Never use dark mode or arbitrary hex/zinc classes.
2. **Field Notes, locked**: One monospace face everywhere; flat fills with no gradients or shadows; the garden is an isometric plot, never a grid of boxes. Full spec in `DESIGN.md`; `styles.html` direction A is the reference rendering. `style.html` is superseded — take nothing from it.
3. **Server Pages + Client Leaves**: `app/**/page.tsx` must be `async` Server Components. Keep client components small and focused on interactivity or `motion/react`.
4. **Auth Gate**: Every authed page begins with `const { supabase, user, profile, groups } = await requireProfile();`.
5. **Ledger Immutability**: Points live in `ledger` table only. Balance = `earn - contribute - redeem`. Tree = `contribute`. Leaderboard = `earn`.
6. **EcoVolt Formula**: $1\%$ energy savings vs baseline $= 10\text{ points}$. Floored at 0.
