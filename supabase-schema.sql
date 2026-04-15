-- Knoll Run Golf League — Supabase schema
-- Run this in the Supabase SQL Editor once.

create extension if not exists "pgcrypto";

-- Tables
create table if not exists players (
  id text primary key,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists rounds (
  id text primary key,
  player_id text not null references players(id) on delete cascade,
  date date not null,
  score int not null,
  course text,
  birdies int default 0,
  eagles int default 0,
  hole_in_ones int default 0,
  pars int default 0,
  bogeys int default 0,
  double_bogeys int default 0,
  fairways int default 0,
  gir int default 0,
  putts int default 0,
  drive int default 0,
  sandies int default 0,
  created_at timestamptz default now()
);

create table if not exists matchups (
  id text primary key,
  date date not null,
  player1_id text not null references players(id) on delete cascade,
  player2_id text not null references players(id) on delete cascade,
  winner_id text, -- a player id, 'tie', or null (unplayed)
  created_at timestamptz default now()
);

-- Row Level Security
alter table players  enable row level security;
alter table rounds   enable row level security;
alter table matchups enable row level security;

-- Public read
drop policy if exists "public read players" on players;
drop policy if exists "public read rounds" on rounds;
drop policy if exists "public read matchups" on matchups;
create policy "public read players"  on players  for select using (true);
create policy "public read rounds"   on rounds   for select using (true);
create policy "public read matchups" on matchups for select using (true);

-- Authenticated write (any signed-in session)
drop policy if exists "auth insert players" on players;
drop policy if exists "auth update players" on players;
drop policy if exists "auth delete players" on players;
create policy "auth insert players" on players for insert to authenticated with check (true);
create policy "auth update players" on players for update to authenticated using (true) with check (true);
create policy "auth delete players" on players for delete to authenticated using (true);

drop policy if exists "auth insert rounds" on rounds;
drop policy if exists "auth update rounds" on rounds;
drop policy if exists "auth delete rounds" on rounds;
create policy "auth insert rounds" on rounds for insert to authenticated with check (true);
create policy "auth update rounds" on rounds for update to authenticated using (true) with check (true);
create policy "auth delete rounds" on rounds for delete to authenticated using (true);

drop policy if exists "auth insert matchups" on matchups;
drop policy if exists "auth update matchups" on matchups;
drop policy if exists "auth delete matchups" on matchups;
create policy "auth insert matchups" on matchups for insert to authenticated with check (true);
create policy "auth update matchups" on matchups for update to authenticated using (true) with check (true);
create policy "auth delete matchups" on matchups for delete to authenticated using (true);
