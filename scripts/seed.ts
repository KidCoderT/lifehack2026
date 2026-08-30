/**
 * Seeds demo users, memberships, 21 days of EcoVolt readings, the points
 * ledger, and a starter alert/nudge. Deterministic (fixed PRNG seed) and
 * idempotent: generated tables are wiped and rebuilt on every run.
 *   bun scripts/seed.ts
 * Needs SUPABASE_SECRET_KEY (Project Settings > API keys) in .env.local.
 */
import { createAdminClient } from "../src/lib/supabase/admin";
import { earnFor, addDays } from "../src/lib/points";

const PASSWORD = "12345678";
const DEMO_EMAIL = "tejas.sunil@u.nus.edu";
const REAL_EMAILS = [
  DEMO_EMAIL,
  "sairathomas@u.nus.edu",
  "ziern_teh@u.nus.edu",
  "vayuntandon@u.nus.edu",
];
const FAKE_LOCALS = [
  "alice.tan", "ben.lim", "chloe.ng", "daniel.koh", "elena.wu", "farhan.i",
  "grace.ho", "hui.min", "ivan.chen", "jia.ying", "kavya.r", "liang.zw",
  "mei.ling", "noah.p", "olivia.s", "priya.nair", "qi.xuan", "ryan.teo",
];
const DAYS = 21;
// SOC is school-wide — everyone is in it, so it needs no size constant. It is the group the
// pitch demos and the one that fills the 5x5 plot. (DEMO_GROUP_SIZE is gone: the roster in
// the memberships block is now explicit rather than a round-robin topped up to a target.)
// Demo group is seeded just short of its goal so the live contribute-to-unlock beat is
// a small, affordable top-up rather than a 750-point cliff.
const DEMO_GROUP_FILL = 0.95;
// Fraction of lifetime earnings any member may have already contributed. The demo user
// keeps a bigger reserve because his wallet has to cover the unlock gap on stage.
const DEMO_WALLET_RESERVE = 0.45;

for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"]) {
  const v = process.env[k];
  if (!v || v.includes("<")) throw new Error(k + " is not set in .env.local");
}

// mulberry32 — deterministic PRNG so every seed run produces identical data.
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260829);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

const admin = createAdminClient();

async function insertChunked(table: string, rows: object[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from(table).insert(rows.slice(i, i + 500));
    if (error) throw new Error(`${table} insert: ${error.message}`);
  }
}

// ---- groups -----------------------------------------------------------------
const { data: groups, error: groupErr } = await admin
  .from("groups")
  .select("id, name, emoji, goal_points")
  .order("id");
if (groupErr) throw groupErr;
if (!groups?.length) throw new Error("No groups found — run supabase/schema.sql first.");

// ---- users + profiles -------------------------------------------------------
const emails = [...REAL_EMAILS, ...FAKE_LOCALS.map((l) => `${l}@u.nus.edu`)];

const { data: existing, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) throw listErr;
const byEmail = new Map(existing.users.map((u) => [u.email, u.id]));

const users: { id: string; email: string; username: string }[] = [];
for (const email of emails) {
  let id = byEmail.get(email);
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    id = data.user.id;
  }
  users.push({ id, email, username: email.split("@")[0] });
}

// Existing users keep the username they picked (ignoreDuplicates).
const { error: profErr } = await admin
  .from("profiles")
  .upsert(users.map((u) => ({ id: u.id, username: u.username })), {
    onConflict: "id",
    ignoreDuplicates: true,
  });
if (profErr) throw profErr;

// A profile row that already existed with a NULL username never gets one from the
// upsert above (ignoreDuplicates), so that account lands on the leaderboard blank and
// no re-seed can repair it. Fill only the nulls — a username someone actually picked
// is still left alone.
for (const u of users) {
  const { error } = await admin
    .from("profiles")
    .update({ username: u.username })
    .eq("id", u.id)
    .is("username", null);
  if (error) throw new Error(`username backfill for ${u.email}: ${error.message}`);
}

// ---- memberships ------------------------------------------------------------
// Resolved by NAME, never by array position: group_id is a serial and the pitch depends on
// SOC being the lowest id (/garden redirects there), so a positional lookup would fail
// silently and quietly point the demo at the wrong garden.
const groupByName = new Map(groups.map((g) => [g.name as string, g.id as number]));
for (const n of ["SOC", "Raffles Hall", "NUSC"]) {
  if (!groupByName.has(n)) throw new Error(`Group "${n}" is missing — apply supabase/schema.sql first.`);
}
const SOC = groupByName.get("SOC")!;
const RAFFLES = groupByName.get("Raffles Hall")!;
const NUSC = groupByName.get("NUSC")!;

const idOf = (email: string) => {
  const u = users.find((x) => x.email === email);
  if (!u) throw new Error(`No seeded user for ${email}`);
  return u.id;
};
const fake = (n: number, m: number) => FAKE_LOCALS.slice(n, m).map((l) => `${l}@u.nus.edu`);

// SOC is school-wide: everyone is in it, and it is the group the pitch demos, so it is the
// one that has to fill the 5x5 plot.
const memberships = users.map((u) => ({ user_id: u.id, group_id: SOC }));

// The residential hall and the college. Real members are explicit; the fakes are padding so
// these plots read as inhabited rather than as two nearly-empty grids.
const ROSTER: [number, string[]][] = [
  [RAFFLES, [DEMO_EMAIL, "sairathomas@u.nus.edu", ...fake(0, 10)]],
  [NUSC, ["ziern_teh@u.nus.edu", ...fake(10, 18)]],
];
for (const [groupId, emails] of ROSTER) {
  for (const email of emails) memberships.push({ user_id: idOf(email), group_id: groupId });
}

const demo = users.find((u) => u.email === DEMO_EMAIL)!;
const demoGroupId = SOC;

// Wipe first: this table is a composite PK with no `id`, so it is not covered by the
// generated-data wipe below. Without this, memberships from a previous seed survive and the
// explicit roster above is polluted by whatever the old model assigned.
const { error: memWipeErr } = await admin.from("group_memberships").delete().gt("group_id", 0);
if (memWipeErr) throw new Error(`group_memberships wipe: ${memWipeErr.message}`);

const { error: memErr } = await admin
  .from("group_memberships")
  .upsert(memberships, { onConflict: "user_id,group_id", ignoreDuplicates: true });
if (memErr) throw memErr;

// ---- wipe generated data ----------------------------------------------------
for (const table of ["ledger", "events", "redemptions", "readings"]) {
  const { error } = await admin.from(table).delete().gte("id", 0);
  if (error) throw new Error(`${table} wipe: ${error.message}`);
}

// ---- readings + earn ledger -------------------------------------------------
// Days end yesterday (UTC); /demo advances from wherever the data ends.
const endDay = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const startDay = addDays(endDay, -(DAYS - 1));

type Reading = { user_id: string; day: string; kind: string; baseline: number; actual: number };
type Earn = { user_id: string; group_id: null; kind: "earn"; points: number; day: string };
const readings: Reading[] = [];
const earns: Earn[] = [];
const earnedBy = new Map<string, number>();

users.forEach((u, i) => {
  const energyBase = between(8, 15);
  const waterBase = between(120, 180);
  // First few fake users trend worse — they're the nudge targets in the demo.
  const tendency = i >= REAL_EMAILS.length && i < REAL_EMAILS.length + 4
    ? between(-0.05, 0)
    : between(0.01, 0.12);

  let total = 0;
  for (let d = 0; d < DAYS; d++) {
    const day = addDays(startDay, d);
    const ratio = 1 - tendency + between(-0.03, 0.03);
    const actual = energyBase * ratio;
    readings.push(
      { user_id: u.id, day, kind: "energy", baseline: +energyBase.toFixed(2), actual: +actual.toFixed(2) },
      { user_id: u.id, day, kind: "water", baseline: +waterBase.toFixed(1), actual: +(waterBase * (ratio + between(-0.02, 0.02))).toFixed(1) },
    );
    const pts = earnFor(energyBase, actual);
    if (pts > 0) {
      earns.push({ user_id: u.id, group_id: null, kind: "earn", points: pts, day });
      total += pts;
    }
  }
  earnedBy.set(u.id, total);
});

await insertChunked("readings", readings);
await insertChunked("ledger", earns);

// ---- contributions ----------------------------------------------------------
// Per group: pick a fill target (the demo group lands at DEMO_GROUP_FILL so the live
// contribute-to-unlock moment is a small affordable top-up), split across members by
// earnings, capped at a fraction of what each member earned so wallets stay positive.
// The printed summary reports the realised gap -- copy those numbers into the pitch runbook.
type Contrib = { user_id: string; group_id: number; kind: "contribute"; points: number; day: string };
const contribs: Contrib[] = [];
const contributedBy = new Map<string, number>();
const groupTotals = new Map<number, number>();

for (const g of groups) {
  const memberIds = memberships.filter((m) => m.group_id === g.id).map((m) => m.user_id);
  const pool = memberIds.reduce((s, id) => s + (earnedBy.get(id) ?? 0), 0);
  const pct = g.id === demoGroupId ? DEMO_GROUP_FILL : between(0.45, 0.7);
  const target = Math.round(g.goal_points * pct);

  let groupSum = 0;
  for (const id of memberIds) {
    const earned = earnedBy.get(id) ?? 0;
    const already = contributedBy.get(id) ?? 0;
    const capFrac = id === demo.id ? DEMO_WALLET_RESERVE : 0.9;
    const share = Math.min(
      Math.round((target * earned) / Math.max(pool, 1)),
      Math.floor(earned * capFrac) - already,
    );
    if (share <= 0) continue;
    contributedBy.set(id, already + share);
    groupSum += share;
    // 2-3 lump contributions spread over the period reads more human than one row.
    const lumps = 2 + Math.floor(rand() * 2);
    let left = share;
    for (let l = 0; l < lumps; l++) {
      const pts = l === lumps - 1 ? left : Math.max(1, Math.round(share / lumps));
      if (pts <= 0) break;
      left -= pts;
      contribs.push({
        user_id: id, group_id: g.id, kind: "contribute", points: pts,
        day: addDays(startDay, Math.floor(between(3, DAYS - 1))),
      });
    }
  }
  groupTotals.set(g.id, groupSum);
}
await insertChunked("ledger", contribs);

// ---- starter events ---------------------------------------------------------
const demoGroup = groups[0];
const peer = users[REAL_EMAILS.length]; // first fake user
const { error: evErr } = await admin.from("events").insert([
  {
    kind: "alert", group_id: demoGroup.id, status: "open", message: "Lights left on in Common Room (Level 3)",
  },
  {
    kind: "alert", group_id: demoGroup.id, status: "open", message: "Aircon running with the windows open in Study Pod B",
  },
  {
    kind: "alert", group_id: demoGroup.id, status: "open", message: "Pantry kettle left on the boil overnight",
  },
  {
    // Already handled, so the inbox has a resolved card to show the photo + credit layout.
    kind: "alert", group_id: demoGroup.id, status: "fixed", resolved_by: peer.id,
    message: "Corridor lights on at midday (Level 2)",
  },
  {
    kind: "nudge", group_id: demoGroup.id, status: "open", from_user: peer.id, to_user: demo.id,
    message: `🌱 ${peer.username} sent you a leaf — no savings logged yesterday!`,
  },
]);
if (evErr) throw evErr;

// ---- summary ----------------------------------------------------------------
console.log(`\n${users.length} users seeded, ${readings.length} readings (${startDay} → ${endDay})`);
for (const g of groups) {
  const n = memberships.filter((m) => m.group_id === g.id).length;
  const sum = groupTotals.get(g.id) ?? 0;
  const gap = Math.max(0, g.goal_points - sum);
  console.log(`  ${g.emoji} ${g.name}: ${n} members, ${sum}/${g.goal_points} pts (${Math.round((100 * sum) / g.goal_points)}%), gap ${gap}`);
}
const wallet = (earnedBy.get(demo.id) ?? 0) - (contributedBy.get(demo.id) ?? 0);
console.log(`\nDemo user ${DEMO_EMAIL}: earned ${earnedBy.get(demo.id)}, wallet ${wallet}`);
const demoGap = Math.max(0, groups[0].goal_points - (groupTotals.get(demoGroupId) ?? 0));
// The pitch runbook quotes these two numbers. If the check ever prints NO, retune
// DEMO_GROUP_FILL / DEMO_WALLET_RESERVE before going on stage.
console.log(
  `Pitch unlock beat: contribute ${demoGap} pts to ${groups[0].name} -- wallet covers it: ` +
  (wallet >= demoGap ? "YES" : "NO, retune DEMO_GROUP_FILL"),
);
console.log(`Password for all accounts: ${PASSWORD}`);
