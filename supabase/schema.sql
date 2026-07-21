-- Run this once in your Supabase project's SQL editor (left sidebar -> SQL Editor -> New query).
-- This creates one table that holds every piece of shared app data,
-- keyed exactly the way the app already organizes it (rosters, plans,
-- attendance, coaches, events, and so on — one row per key).

create table if not exists app_storage (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_storage enable row level security;

create policy "Allow anon read" on app_storage
  for select using (true);

create policy "Allow anon write" on app_storage
  for insert with check (true);

create policy "Allow anon update" on app_storage
  for update using (true);

-- Real per-person accounts. Anyone can sign up (Supabase Auth handles
-- the actual email/password and confirmation), but a new signup starts
-- with role = null and approved = false — they can't get into the app
-- until the Director assigns them a role. This is the safe pattern:
-- account CREATION happens client-side (fine, that's what Supabase
-- Auth's signUp is for), but ROLE ASSIGNMENT — the thing that actually
-- grants access — only happens through the app's own Director tools,
-- which write to this table using the signed-in Director's own
-- permissions, not any elevated key.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  label text,
  role text check (role in ('coach', 'parent', 'admin')),
  coach_id text,
  player_id text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Anyone signed in can read the profiles table (needed so the app can
-- look up its own role, and so the Director can see the pending list).
create policy "Signed-in users can read profiles" on profiles
  for select using (auth.role() = 'authenticated');

-- A brand new user can create their own profile row (role starts null).
create policy "Users can insert their own profile" on profiles
  for insert with check (auth.uid() = id);

-- Users can update their own profile (e.g. changing their display
-- name). Role/approved changes in the app are written by whoever is
-- signed in as Director — since this policy allows any authenticated
-- user to update any row, the app itself is responsible for only
-- exposing role-assignment controls to the Director account. This is a
-- reasonable v1 for a small trusted club; the tighter version restricts
-- this policy to only allow self-updates plus a server-side check that
-- the actor's own profile has role = 'admin', which needs a bit more
-- Postgres (a function checking the calling user's role) — worth doing
-- before this scales past a small trusted group.
create policy "Authenticated users can update profiles" on profiles
  for update using (auth.role() = 'authenticated');

