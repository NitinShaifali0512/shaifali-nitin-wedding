-- =====================================================================
--  Shaifali & Nitin wedding website: database and security setup
-- =====================================================================
--
--  HOW TO USE
--  1. Open your Supabase project, go to "SQL Editor" and click "New query".
--  2. Paste this whole file and click "Run".
--  3. Create your login under "Authentication", "Users", "Add user"
--     (tick "Auto Confirm User"), then run this one line in the SQL Editor,
--     with your own email address:
--
--         select public.grant_admin('you@example.com');
--
--  It is safe to run this file again at any time. It never deletes website
--  content, RSVP responses or uploaded files.
--
--  WHAT IT CREATES
--  admins         who may sign in to the dashboard
--  site_content   the website text and settings (one draft, one published copy)
--  site_versions  a history of what was published, so a version can be restored
--  rsvps          guest responses (guests can add one, only admins can read them)
--  media bucket   photographs and music uploaded through the dashboard
--
--  Every table has Row Level Security switched on. The website only ever
--  uses the public ("publishable" or "anon") key, so these rules are what
--  keep the guest list private and the content safe.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Administrators
-- ---------------------------------------------------------------------
-- Signing in is not enough to manage the website: the account must also be
-- listed here. This matters because Supabase projects allow anyone to
-- register an account unless sign-ups are switched off.

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Run from the SQL Editor only; the website itself can never call this.
create or replace function public.grant_admin(admin_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_id uuid;
begin
  select u.id into found_id
  from auth.users u
  where lower(u.email) = lower(btrim(admin_email));

  if found_id is null then
    raise exception 'No user with the email "%" exists yet. Create the user first under Authentication > Users.', admin_email;
  end if;

  insert into public.admins (user_id, email)
  values (found_id, lower(btrim(admin_email)))
  on conflict (user_id) do update set email = excluded.email;

  return admin_email || ' can now sign in to the dashboard.';
end;
$$;

create or replace function public.revoke_admin(admin_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.admins a where lower(a.email) = lower(btrim(admin_email));
  return admin_email || ' can no longer use the dashboard.';
end;
$$;

revoke all on function public.grant_admin(text) from public, anon, authenticated;
revoke all on function public.revoke_admin(text) from public, anon, authenticated;

revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

drop policy if exists "Admins can see the admin list" on public.admins;
create policy "Admins can see the admin list"
  on public.admins for select
  to authenticated
  using ((select public.is_admin()));


-- ---------------------------------------------------------------------
-- 2. Website content (draft and published)
-- ---------------------------------------------------------------------

create table if not exists public.site_content (
  id         text primary key check (id in ('draft', 'published')),
  content    jsonb not null check (jsonb_typeof(content) = 'object' and pg_column_size(content) < 1000000),
  revision   integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.site_content enable row level security;

-- Keeps the "last changed" details honest and counts revisions, which lets
-- the dashboard notice when two people edit at the same time.
create or replace function public.site_content_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  if tg_op = 'UPDATE' then
    new.revision := old.revision + 1;
  else
    new.revision := 1;
  end if;
  return new;
end;
$$;

drop trigger if exists site_content_touch on public.site_content;
create trigger site_content_touch
  before insert or update on public.site_content
  for each row execute function public.site_content_touch();

revoke all on public.site_content from anon, authenticated;
grant select on public.site_content to anon, authenticated;
grant insert (id, content), update (content) on public.site_content to authenticated;

drop policy if exists "Anyone can read the published website" on public.site_content;
create policy "Anyone can read the published website"
  on public.site_content for select
  to anon, authenticated
  using (id = 'published');

drop policy if exists "Admins can read the draft" on public.site_content;
create policy "Admins can read the draft"
  on public.site_content for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can create content" on public.site_content;
create policy "Admins can create content"
  on public.site_content for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admins can change content" on public.site_content;
create policy "Admins can change content"
  on public.site_content for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));


-- ---------------------------------------------------------------------
-- 3. Publishing history
-- ---------------------------------------------------------------------

create table if not exists public.site_versions (
  id           bigint generated always as identity primary key,
  content      jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null
);

alter table public.site_versions enable row level security;

revoke all on public.site_versions from anon, authenticated;
grant select on public.site_versions to authenticated;

drop policy if exists "Admins can read the publishing history" on public.site_versions;
create policy "Admins can read the publishing history"
  on public.site_versions for select
  to authenticated
  using ((select public.is_admin()));

-- Copies the draft to the published row in one step, and keeps a copy in the
-- history. `expected_revision` is the draft revision the dashboard last saw;
-- if someone else has saved in between, nothing is published.
create or replace function public.publish_site(expected_revision integer default null)
returns table (revision integer, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft_row public.site_content%rowtype;
begin
  if not (select public.is_admin()) then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  select * into draft_row from public.site_content s where s.id = 'draft' for update;
  if not found then
    raise exception 'no_draft' using errcode = 'P0002';
  end if;
  if expected_revision is not null and draft_row.revision <> expected_revision then
    raise exception 'draft_changed' using errcode = '40001';
  end if;

  insert into public.site_content (id, content)
  values ('published', draft_row.content)
  on conflict (id) do update set content = excluded.content;

  insert into public.site_versions (content, published_by)
  values (draft_row.content, (select auth.uid()));

  -- Keep the 30 most recent versions.
  delete from public.site_versions v
  where v.id not in (select k.id from public.site_versions k order by k.id desc limit 30);

  return query
    select s.revision, s.updated_at from public.site_content s where s.id = 'published';
end;
$$;

revoke all on function public.publish_site(integer) from public, anon;
grant execute on function public.publish_site(integer) to authenticated;


-- ---------------------------------------------------------------------
-- 4. RSVP responses
-- ---------------------------------------------------------------------

create table if not exists public.rsvps (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  guest_name  text not null check (char_length(btrim(guest_name)) between 2 and 120),
  mobile      text not null check (mobile ~ '^\+?[0-9]{10,15}$'),
  guest_count integer not null check (guest_count between 0 and 50),
  events      jsonb not null default '[]'::jsonb
              check (jsonb_typeof(events) = 'array' and jsonb_array_length(events) <= 20 and pg_column_size(events) < 4000),
  message     text check (message is null or char_length(message) <= 1000),
  admin_note  text check (admin_note is null or char_length(admin_note) <= 1000),
  -- A guest who cannot attend sends zero guests and no events.
  constraint rsvps_attendance_makes_sense check (guest_count >= 1 or jsonb_array_length(events) = 0)
);

create index if not exists rsvps_created_at_idx on public.rsvps (created_at desc);
create index if not exists rsvps_mobile_idx on public.rsvps (mobile);

alter table public.rsvps enable row level security;

-- True while the RSVP form is switched on in the published website, and the
-- party size is within the limit set in the dashboard.
create or replace function public.rsvp_is_open(party_size integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select coalesce((s.content -> 'rsvp' ->> 'enabled')::boolean, true)
         and party_size <= coalesce((s.content -> 'rsvp' ->> 'maxGuests')::integer, 50)
      from public.site_content s
      where s.id = 'published'
    ),
    true  -- nothing published yet: the built-in defaults apply, and they accept RSVPs
  );
$$;

revoke all on function public.rsvp_is_open(integer) from public;
grant execute on function public.rsvp_is_open(integer) to anon, authenticated;

-- Runs for every new response: fixes the fields a guest must not control and
-- slows down anyone trying to flood the list.
create or replace function public.rsvps_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_total  integer;
  recent_mobile integer;
begin
  new.id := gen_random_uuid();
  new.created_at := now();
  new.admin_note := null;
  new.guest_name := btrim(regexp_replace(new.guest_name, '\s+', ' ', 'g'));
  new.message := nullif(btrim(new.message), '');

  select count(*) into recent_total
  from public.rsvps r where r.created_at > now() - interval '10 minutes';
  if recent_total >= 200 then
    raise exception 'rsvp_rate_limited' using errcode = 'P0001';
  end if;

  select count(*) into recent_mobile
  from public.rsvps r where r.mobile = new.mobile and r.created_at > now() - interval '1 day';
  if recent_mobile >= 8 then
    raise exception 'rsvp_rate_limited' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.rsvps_before_insert() from public, anon, authenticated;

drop trigger if exists rsvps_before_insert on public.rsvps;
create trigger rsvps_before_insert
  before insert on public.rsvps
  for each row execute function public.rsvps_before_insert();

-- Guests may add a response and nothing else. They cannot read, change or
-- delete any response, including their own.
revoke all on public.rsvps from anon, authenticated;
grant insert (guest_name, mobile, guest_count, events, message) on public.rsvps to anon, authenticated;
grant select, delete on public.rsvps to authenticated;
grant update (admin_note) on public.rsvps to authenticated;

drop policy if exists "Guests can send an RSVP while the form is open" on public.rsvps;
create policy "Guests can send an RSVP while the form is open"
  on public.rsvps for insert
  to anon, authenticated
  with check ((select public.rsvp_is_open(guest_count)));

drop policy if exists "Admins can read RSVPs" on public.rsvps;
create policy "Admins can read RSVPs"
  on public.rsvps for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can annotate RSVPs" on public.rsvps;
create policy "Admins can annotate RSVPs"
  on public.rsvps for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins can delete RSVPs" on public.rsvps;
create policy "Admins can delete RSVPs"
  on public.rsvps for delete
  to authenticated
  using ((select public.is_admin()));


-- ---------------------------------------------------------------------
-- 5. Storage for photographs and music
-- ---------------------------------------------------------------------
-- The bucket is public so that guests can see the photographs and hear the
-- music. Only administrators can add, replace, list or remove files.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  26214400, -- 25 MB per file
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
    'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac',
    'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can list wedding media" on storage.objects;
create policy "Admins can list wedding media"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));

drop policy if exists "Admins can upload wedding media" on storage.objects;
create policy "Admins can upload wedding media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media' and (select public.is_admin()));

drop policy if exists "Admins can replace wedding media" on storage.objects;
create policy "Admins can replace wedding media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (bucket_id = 'media' and (select public.is_admin()));

drop policy if exists "Admins can delete wedding media" on storage.objects;
create policy "Admins can delete wedding media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));


-- ---------------------------------------------------------------------
-- Finished. Next: create your user and run
--     select public.grant_admin('you@example.com');
-- ---------------------------------------------------------------------
