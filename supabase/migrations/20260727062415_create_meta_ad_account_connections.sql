-- Ad Performance Tracker: one Meta ad account connection per user.
-- Safe to re-run: uses "if not exists" / "drop ... if exists" throughout, no destructive drops.

create table if not exists public.meta_ad_account_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  ad_account_id text not null,
  access_token text not null,
  token_expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.meta_ad_account_connections enable row level security;

drop policy if exists "Users can view their own Meta connection" on public.meta_ad_account_connections;
create policy "Users can view their own Meta connection"
  on public.meta_ad_account_connections for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own Meta connection" on public.meta_ad_account_connections;
create policy "Users can insert their own Meta connection"
  on public.meta_ad_account_connections for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own Meta connection" on public.meta_ad_account_connections;
create policy "Users can update their own Meta connection"
  on public.meta_ad_account_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
