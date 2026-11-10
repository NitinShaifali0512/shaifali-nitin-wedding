-- ---------------------------------------------------------------------
--  A minimal copy of what every Supabase project already contains before
--  supabase/schema.sql is run: the API roles, the auth schema with
--  auth.uid(), the storage schema, and Supabase's default privileges.
--
--  It exists only so that the real schema.sql can be loaded into a plain
--  PostgreSQL database for testing. It is never run against Supabase.
-- ---------------------------------------------------------------------

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

-- auth ----------------------------------------------------------------
create schema auth;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  aud                varchar(255) default 'authenticated',
  role               varchar(255) default 'authenticated',
  email              varchar(255) unique,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz default now(),
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create function auth.role() returns text language sql stable as $$
  select auth.jwt() ->> 'role';
$$;

grant usage on schema auth to anon, authenticated, service_role;

-- public: Supabase grants everything by default and relies on Row Level
-- Security, so the test starts from the same permissive position.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- storage -------------------------------------------------------------
create schema storage;

create table storage.buckets (
  id                 text primary key,
  name               text not null unique,
  owner              uuid,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  public             boolean default false,
  avif_autodetection boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  owner_id           text
);

create table storage.objects (
  id               uuid primary key default gen_random_uuid(),
  bucket_id        text references storage.buckets (id),
  name             text,
  owner            uuid,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata         jsonb,
  path_tokens      text[] generated always as (string_to_array(name, '/')) stored,
  version          text,
  owner_id         text,
  user_metadata    jsonb,
  unique (bucket_id, name)
);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;

grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
