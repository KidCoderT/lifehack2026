-- Run in the Supabase SQL editor. Safe to re-run.

create table if not exists public.groups (
  id    serial primary key,
  name  text not null unique,
  emoji text not null default '🌱'
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  username   text unique check (char_length(username) between 3 and 20),
  avatar_url text,
  group_id   int references public.groups on delete set null
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

-- Users may change their own username/avatar, never their group. A trigger rather
-- than a column REVOKE because REVOKE silently no-ops when another role granted it.
create or replace function public.lock_group() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user = 'authenticated' and new.group_id is distinct from old.group_id then
    raise exception 'group_id is not user-editable';
  end if;
  return new;
end $$;

drop trigger if exists lock_group on public.profiles;
create trigger lock_group before update on public.profiles
  for each row execute function public.lock_group();

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

insert into public.groups (name, emoji) values
  ('Solar Squad', '☀️'), ('Compost Crew', '🍃'), ('Tide Turners', '🌊')
on conflict (name) do nothing;
