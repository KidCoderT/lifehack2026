-- Run in the Supabase SQL editor. Safe to re-run.

create table if not exists public.groups (
  id    serial primary key,
  name  text not null unique,
  emoji text not null default '🌱'
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  username   text unique check (char_length(username) between 3 and 20),
  avatar_url text
);
alter table public.profiles add column if not exists avatar_url text;

alter table public.groups   enable row level security;
alter table public.profiles enable row level security;

-- Data API access (RLS below decides which rows).
grant select on public.groups to authenticated;
grant select, update on public.profiles to authenticated;

drop policy if exists "groups readable"    on public.groups;
drop policy if exists "profiles readable"  on public.profiles;
drop policy if exists "own profile update" on public.profiles;

create policy "groups readable"   on public.groups   for select to authenticated using (true);
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated
  using  ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Memberships moved to group_memberships (service-role writes only), so the old
-- single-group column and its lock trigger are gone.
drop trigger if exists lock_group on public.profiles;
drop function if exists public.lock_group();
alter table public.profiles drop column if exists group_id;

-- Avatars: public bucket, each user owns the folder named after their uid.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar read"  on storage.objects;
drop policy if exists "avatar write" on storage.objects;

create policy "avatar read" on storage.objects for select to public
  using (bucket_id = 'avatars');
-- upsert needs insert + select + update, hence `for all`.
create policy "avatar write" on storage.objects for all to authenticated
  using  (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Renamed to the real NUS communities the team belongs to. These updates run BEFORE the
-- insert so an already-seeded project is migrated in place — the ids are preserved, which
-- matters: ledger, readings and memberships all key off group_id, and /garden redirects to
-- a user's LOWEST group id, so SOC must stay id 1 or the first garden a judge opens is a
-- near-empty plot. No-ops once applied, and no-ops on a fresh database.
update public.groups set name = 'SOC',          emoji = '💻' where name = 'Solar Squad';
update public.groups set name = 'Raffles Hall', emoji = '🏛️' where name = 'Compost Crew';
update public.groups set name = 'NUSC',         emoji = '🎓' where name = 'Tide Turners';

insert into public.groups (name, emoji) values
  ('SOC', '💻'), ('Raffles Hall', '🏛️'), ('NUSC', '🎓')
on conflict (name) do nothing;

-- ============================ Evergreen ============================

-- Community goal.
alter table public.groups add column if not exists goal_title  text not null default 'Community reward';
alter table public.groups add column if not exists goal_points int  not null default 5000;

-- Who belongs where. Service-role writes only (seeded by the organization).
create table if not exists public.group_memberships (
  user_id  uuid not null references public.profiles on delete cascade,
  group_id int  not null references public.groups   on delete cascade,
  primary key (user_id, group_id)
);

-- EcoVolt meter data. Service-role writes only (seed + /demo).
create table if not exists public.readings (
  id       bigserial primary key,
  user_id  uuid not null references public.profiles on delete cascade,
  day      date not null,
  kind     text not null default 'energy' check (kind in ('energy','water')),
  baseline numeric not null,
  actual   numeric not null,
  unique (user_id, day, kind)
);

-- One ledger drives every number:
--   earn:       group_id null, service-role only. Leaderboard = sum(earn).
--   contribute: group_id set, user-inserted. Community bar + tree = sum(contribute).
--   redeem:     group_id null, user-inserted with a redemptions row.
-- Wallet = earn - contribute - redeem.
create table if not exists public.ledger (
  id       bigserial primary key,
  user_id  uuid not null references public.profiles on delete cascade,
  group_id int references public.groups on delete cascade,
  kind     text not null check (kind in ('earn','contribute','redeem')),
  points   int  not null check (points > 0),
  day      date not null default current_date,
  check (kind <> 'contribute' or group_id is not null)
);

create table if not exists public.vouchers (
  id          serial primary key,
  title       text not null unique,
  description text,
  emoji       text not null default '🎟️',
  cost        int  not null default 0,   -- 0 for group scope (unlocked by goal, not wallet)
  scope       text not null default 'personal' check (scope in ('personal','group')),
  group_id    int references public.groups on delete cascade
);

create table if not exists public.redemptions (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  voucher_id int  not null references public.vouchers on delete cascade,
  code       text not null default upper(substr(md5(random()::text), 1, 8)),
  created_at timestamptz not null default now()
);

-- Nudges + waste alerts.
--   nudge: from_user = sender, to_user set. alert: from_user/to_user null, group-wide.
create table if not exists public.events (
  id         bigserial primary key,
  kind       text not null check (kind in ('nudge','alert')),
  group_id   int  not null references public.groups on delete cascade,
  from_user  uuid references public.profiles on delete set null,
  to_user    uuid references public.profiles on delete cascade,
  message    text not null,
  status     text not null default 'open' check (status in ('open','fixed','reported')),
  created_at timestamptz not null default now()
);

-- Phase 4.5: resolving a waste alert carries evidence and an author.
-- Added as ALTERs, not columns above, so re-running this file on a live project is safe.
alter table public.events add column if not exists photo_url   text;
alter table public.events add column if not exists resolved_by uuid
  references public.profiles on delete set null;

alter table public.group_memberships enable row level security;
alter table public.readings          enable row level security;
alter table public.ledger            enable row level security;
alter table public.vouchers          enable row level security;
alter table public.redemptions       enable row level security;
alter table public.events            enable row level security;

grant select on public.group_memberships, public.readings, public.ledger,
                public.vouchers, public.redemptions, public.events to authenticated;
grant insert on public.ledger, public.redemptions, public.events to authenticated;
grant update on public.events to authenticated;
grant usage on all sequences in schema public to authenticated;

drop policy if exists "memberships readable" on public.group_memberships;
drop policy if exists "readings readable"    on public.readings;
drop policy if exists "ledger readable"      on public.ledger;
drop policy if exists "spend own points"     on public.ledger;
drop policy if exists "vouchers readable"    on public.vouchers;
drop policy if exists "own redemptions"      on public.redemptions;
drop policy if exists "redeem own"           on public.redemptions;
drop policy if exists "events readable"      on public.events;
drop policy if exists "send nudge"           on public.events;
drop policy if exists "resolve alert"        on public.events;

-- Nothing here is secret; leaderboard/garden need everyone's rows.
create policy "memberships readable" on public.group_memberships for select to authenticated using (true);
create policy "readings readable"    on public.readings          for select to authenticated using (true);
create policy "ledger readable"      on public.ledger            for select to authenticated using (true);
create policy "vouchers readable"    on public.vouchers          for select to authenticated using (true);
create policy "events readable"      on public.events            for select to authenticated using (true);
create policy "own redemptions"      on public.redemptions       for select to authenticated
  using ((select auth.uid()) = user_id);

-- Users can spend points, never mint them (earn is service-role only).
create policy "spend own points" on public.ledger for insert to authenticated
  with check ((select auth.uid()) = user_id and kind in ('contribute','redeem'));
create policy "redeem own" on public.redemptions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "send nudge" on public.events for insert to authenticated
  with check ((select auth.uid()) = from_user and kind = 'nudge' and to_user is not null);
-- Anyone can resolve a community alert; only the recipient can dismiss a nudge.
create policy "resolve alert" on public.events for update to authenticated
  using (kind = 'alert' or (select auth.uid()) = to_user)
  with check (kind = 'alert' or (select auth.uid()) = to_user);

-- Resolving a community waste alert mints points, and clients may never insert `earn`
-- ("spend own points" allows contribute/redeem only). This function is the single
-- sanctioned path: security definer, so it runs as owner and bypasses that policy,
-- while enforcing the rules the policy cannot express.
--
-- The `and status = 'open'` inside the UPDATE is load-bearing: it claims the alert
-- atomically, so concurrent taps cannot both be paid. Zero rows updated -> already
-- resolved, not an alert, or not your group -> returns 0 and pays nothing. This is
-- strictly safer than contributePoints, which is a documented read-then-write race.
--
-- The payout ladder is evidence-first, and it lives here rather than in the client so a
-- crafted request cannot pick its own number:
--   fixed + photo    100  -- you walked to the room and proved it
--   reported + photo  50  -- you can't fix it, but you proved it is real
--   reported          10  -- a bare flag, worth something, worth little
-- Proof is what pays, so someone who genuinely cannot fix a thing is not punished for
-- reporting it, while a bare tap from the sofa never out-earns walking over. `fixed`
-- without a photo is rejected outright: the photo IS the trust mechanism for the top
-- award, so accepting it unproven would make the other two rungs pointless.
--
-- Points are still energy points -- a common-room light is not on the resolver's own
-- meter, so this is attribution of a real saving, not a second currency.
create or replace function public.resolve_alert(
  p_event_id  bigint,
  p_action    text,
  p_photo_url text default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id int;
  v_points   int;
begin
  if p_action not in ('fixed', 'reported') then
    raise exception 'resolve_alert: bad action %', p_action;
  end if;
  if p_action = 'fixed' and p_photo_url is null then
    raise exception 'resolve_alert: fixing needs a photo';
  end if;
  v_points := case
                when p_action = 'fixed'      then 100
                when p_photo_url is not null then 50
                else 10
              end;

  update public.events
     set status      = p_action,
         resolved_by = (select auth.uid()),
         photo_url   = coalesce(p_photo_url, photo_url)
   where id       = p_event_id
     and kind     = 'alert'
     and status   = 'open'
     and group_id in (
       select group_id from public.group_memberships
        where user_id = (select auth.uid())
     )
  returning group_id into v_group_id;

  if v_group_id is null then
    return 0;
  end if;

  insert into public.ledger (user_id, group_id, kind, points)
  values ((select auth.uid()), v_group_id, 'earn', v_points);

  return v_points;
end;
$$;

revoke all     on function public.resolve_alert(bigint, text, text) from public;
grant  execute on function public.resolve_alert(bigint, text, text) to authenticated;

-- Goals per group (only overwrites the untouched default).
update public.groups set goal_title = 'Universal Studios group discount', goal_points = 5000
  where name = 'SOC' and goal_title = 'Community reward';
update public.groups set goal_title = 'Escape room night', goal_points = 4000
  where name = 'Raffles Hall' and goal_title = 'Community reward';
update public.groups set goal_title = 'Sentosa beach day fund', goal_points = 6000
  where name = 'NUSC' and goal_title = 'Community reward';

-- Voucher catalog. Group vouchers join by group name to dodge serial-id drift.
insert into public.vouchers (title, description, emoji, cost, scope, group_id)
select v.title, v.description, v.emoji, v.cost, v.scope, g.id
from (values
  ('$5 GrabFood voucher',       'Any order above $15',              '🍜', 300, 'personal', null),
  ('Free bubble tea',           'LiHO, any regular drink',          '🧋', 200, 'personal', null),
  ('$10 Kopitiam credit',       'All campus stalls',                '☕', 550, 'personal', null),
  ('Movie ticket',              'GV, any 2D screening',             '🎬', 800, 'personal', null),
  ('Reusable cup + 20% off',    'Campus cafe partner',              '🥤', 150, 'personal', null),
  ('Universal Studios 30% off', 'Unlocked by the community goal',   '🎢',   0, 'group', 'SOC'),
  ('Escape room for the crew',  'Unlocked by the community goal',   '🔐',   0, 'group', 'Raffles Hall'),
  ('Beach day BBQ pit',         'Unlocked by the community goal',   '🏖️',  0, 'group', 'NUSC')
) as v(title, description, emoji, cost, scope, group_name)
left join public.groups g on g.name = v.group_name
on conflict (title) do nothing;
