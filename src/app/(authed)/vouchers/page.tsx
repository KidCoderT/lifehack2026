import { Lock, Ticket } from "lucide-react";
import { requireProfile } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { FadeIn } from "@/components/motion/fade-in";
import {
  ClaimQuestButton,
  RedeemButton,
  VoucherCode,
} from "@/components/rewards/claim-buttons";
import { ContributeCard, type ContributeTarget } from "@/components/rewards/contribute-card";

type Voucher = {
  id: number;
  title: string;
  description: string | null;
  emoji: string;
  cost: number;
  scope: string;
  group_id: number | null;
};

const MICRO = "text-[11.5px] font-medium tracking-[0.11em] text-muted uppercase";

export default async function VouchersPage() {
  const { supabase, user, groups } = await requireProfile();
  const groupIds = groups.map((g) => g.id);

  const [mine, communal, catalogue, redeemed] = await Promise.all([
    supabase.from("ledger").select("kind, points, group_id").eq("user_id", user.id),
    groupIds.length
      ? supabase
          .from("ledger")
          .select("group_id, points")
          .eq("kind", "contribute")
          .in("group_id", groupIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("vouchers").select("id, title, description, emoji, cost, scope, group_id"),
    supabase
      .from("redemptions")
      .select("id, voucher_id, code, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  for (const [what, q] of [
    ["ledger", mine],
    ["contributions", communal],
    ["vouchers", catalogue],
    ["redemptions", redeemed],
  ] as const) {
    if (q.error) console.error(`${what} query:`, q.error);
  }

  // ---- wallet ---------------------------------------------------------------
  // Deliberately the same three lines as / and /garden/[groupId]. Both are verified
  // screens; a shared helper would be a refactor across files for no gain.
  const ledger = mine.data ?? [];
  const total = (kind: string) => ledger.reduce((s, r) => (r.kind === kind ? s + r.points : s), 0);
  const earned = total("earn");
  const wallet = earned - total("contribute") - total("redeem");

  // ---- goals ----------------------------------------------------------------
  const groupTotal = new Map<number, number>();
  for (const r of communal.data ?? []) {
    groupTotal.set(r.group_id, (groupTotal.get(r.group_id) ?? 0) + r.points);
  }
  const myGiving = new Map<number, number>();
  for (const r of ledger) {
    if (r.kind === "contribute" && r.group_id !== null) {
      myGiving.set(r.group_id, (myGiving.get(r.group_id) ?? 0) + r.points);
    }
  }
  const shortfallOf = (g: (typeof groups)[number]) =>
    Math.max(0, g.goal_points - (groupTotal.get(g.id) ?? 0));

  // ---- vouchers -------------------------------------------------------------
  const vouchers = (catalogue.data ?? []) as Voucher[];
  const personal = vouchers.filter((v) => v.scope === "personal").sort((a, b) => a.cost - b.cost);
  const quests = groups
    .map((g) => ({
      group: g,
      voucher: vouchers.find((v) => v.scope === "group" && v.group_id === g.id),
    }))
    .filter((q): q is { group: (typeof groups)[number]; voucher: Voucher } => !!q.voucher);

  const history = redeemed.data ?? [];
  // ponytail: joined in TS rather than a PostgREST FK embed — there are no generated DB
  // types, and server.ts keeps the app's only embed contained to itself.
  const titleOf = new Map(vouchers.map((v) => [v.id, v] as const));
  const claimedCode = new Map(history.map((r) => [r.voucher_id as number, r.code as string]));

  const targets: ContributeTarget[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    emoji: g.emoji,
    goalTitle: g.goal_title,
    shortfall: shortfallOf(g),
  }));

  return (
    <main className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-6">
      <FadeIn>
        <div className="px-1 pb-1">
          <p className={MICRO}>Rewards</p>
          <h1 className="text-[26px] font-bold tracking-[-0.02em]">Spend what you saved</h1>
        </div>
      </FadeIn>

      {/* ---- 1. wallet ------------------------------------------------------- */}
      <FadeIn>
        <Card className="flex flex-col gap-1">
          <p className={MICRO}>Fertilizer points</p>
          <p className="text-[42px] leading-none font-bold tracking-[-0.02em]">
            {wallet.toLocaleString()}
          </p>
          <p className="pt-1 text-[13px] text-muted">
            {earned.toLocaleString()} earned all time · {(earned - wallet).toLocaleString()} already
            given or spent
          </p>
        </Card>
      </FadeIn>

      {/* ---- 2. group goal + shortfall --------------------------------------- */}
      <FadeIn>
        <section className="flex flex-col gap-3">
          <h2 className={`px-1 pt-2 ${MICRO}`}>Community goals</h2>
          {groups.map((g) => {
            const given = groupTotal.get(g.id) ?? 0;
            const short = shortfallOf(g);
            return (
              <Card key={g.id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13.5px] font-semibold">
                    {g.emoji} {g.name}
                  </p>
                  <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-[11.5px] font-medium text-primary">
                    {Math.min(100, Math.round((given / Math.max(g.goal_points, 1)) * 100))}%
                  </span>
                </div>
                <div>
                  <p
                    className={`text-[36px] leading-none font-bold tracking-[-0.02em] ${
                      short ? "" : "text-primary"
                    }`}
                  >
                    {(short || given).toLocaleString()}
                  </p>
                  <p className="pt-1 text-[13px] text-muted">
                    {short
                      ? "points short. Nobody gets it alone."
                      : `points given. Goal reached — claim ${g.goal_title} below.`}
                  </p>
                </div>
                <ProgressBar value={given} max={g.goal_points} />
                <p className="text-[13px] text-muted">
                  {g.goal_title} — {given.toLocaleString()} / {g.goal_points.toLocaleString()} · you
                  gave {(myGiving.get(g.id) ?? 0).toLocaleString()}
                </p>
              </Card>
            );
          })}
          {groups.length === 0 && (
            <Card className="text-[13px] text-muted">
              No community assigned yet. Ask your block rep to add you to one.
            </Card>
          )}
        </section>
      </FadeIn>

      {/* ---- 3. contribute — the primary action ------------------------------ */}
      {targets.length > 0 && (
        <FadeIn>
          <ContributeCard wallet={wallet} targets={targets} />
        </FadeIn>
      )}

      {/* ---- 4. group quests -------------------------------------------------- */}
      {quests.length > 0 && (
        <FadeIn>
          <section className="flex flex-col gap-3">
            <h2 className={`px-1 pt-2 ${MICRO}`}>Community rewards</h2>
            {quests.map(({ group, voucher }) => {
              const short = shortfallOf(group);
              const code = claimedCode.get(voucher.id);
              return (
                <Card key={voucher.id} className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-[26px] leading-none">{voucher.emoji}</span>
                    <div className="flex-1">
                      <p className="text-[13.5px] font-semibold">{voucher.title}</p>
                      <p className="text-[13px] text-muted">
                        {short
                          ? `Locked — ${short.toLocaleString()} points short of ${group.name}'s goal.`
                          : code
                            ? "Claimed. Show this at the counter."
                            : `${group.name} crossed the goal. It's yours.`}
                      </p>
                    </div>
                    {short > 0 && <Lock className="size-4 shrink-0 text-muted" />}
                  </div>
                  {/* Never claimed on render — an insert during a Server Component render
                      would fire on every visit, prefetch included. */}
                  {code ? (
                    <VoucherCode code={code} />
                  ) : (
                    short === 0 && (
                      <ClaimQuestButton voucherId={voucher.id} title={voucher.title} />
                    )
                  )}
                </Card>
              );
            })}
          </section>
        </FadeIn>
      )}

      {/* ---- 5. personal catalogue ------------------------------------------- */}
      <FadeIn>
        <section className="flex flex-col gap-3">
          <h2 className={`px-1 pt-2 ${MICRO}`}>Spend your points</h2>
          {personal.map((v) => (
            <Card key={v.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className="text-[26px] leading-none">{v.emoji}</span>
                <div className="flex-1">
                  <p className="text-[13.5px] font-semibold">{v.title}</p>
                  <p className="text-[13px] text-muted">{v.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-[11.5px] font-bold text-primary">
                  {v.cost.toLocaleString()} pts
                </span>
              </div>
              <RedeemButton voucherId={v.id} cost={v.cost} wallet={wallet} />
            </Card>
          ))}
          {personal.length === 0 && (
            <Card className="text-[13px] text-muted">No rewards listed yet.</Card>
          )}
        </section>
      </FadeIn>

      {/* ---- 6. my vouchers --------------------------------------------------- */}
      <FadeIn>
        <section className="flex flex-col gap-3">
          <h2 className={`px-1 pt-2 ${MICRO}`}>My vouchers</h2>
          <Card className="flex flex-col gap-1 p-2">
            {history.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <Ticket className="size-4 shrink-0 text-primary" />
                <div className="flex-1">
                  <p className="text-[13.5px] font-semibold">
                    {titleOf.get(r.voucher_id)?.title ?? "Reward"}
                  </p>
                  <p className="text-[13px] text-muted">
                    {/* created_at is a real instant, so the zone is pinned to the user's,
                        not the server's — a 07:00 SGT code is 23:00 UTC the day before. */}
                    {new Date(r.created_at).toLocaleDateString("en-SG", {
                      day: "numeric",
                      month: "short",
                      timeZone: "Asia/Singapore",
                    })}
                  </p>
                </div>
                <span className="shrink-0 text-[13.5px] font-bold tracking-[0.11em]">{r.code}</span>
              </div>
            ))}
            {history.length === 0 && (
              <p className="px-3 py-2.5 text-[13px] text-muted">
                Nothing redeemed yet. Your codes land here the moment you spend.
              </p>
            )}
          </Card>
        </section>
      </FadeIn>
    </main>
  );
}
