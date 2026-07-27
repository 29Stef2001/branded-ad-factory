-- Launch in Meta: an audit log of every attempt to create an ad from a concept.
-- Safe to re-run: "create table if not exists" / "drop policy if exists" throughout.
--
-- Every attempt is recorded, successful or not. A launch is the one action in
-- this app that spends money and appears in public, so "what did we send, what
-- came back, and when" has to survive the request that made it — an error
-- rendered once in the UI and then lost is not enough to reconstruct what
-- happened to a live ad account.

create table if not exists public.meta_launch_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  concept_id uuid not null references public.ad_concepts (id) on delete cascade,

  -- Denormalized rather than joined from meta_ad_account_connections: that row
  -- can be re-linked to a different ad account later, and this log has to keep
  -- saying which account was actually targeted at the time.
  ad_account_id text not null,

  -- 'draft' and 'paused' are the only modes the app can request today.
  -- 'active' exists so the column doesn't need widening if publishing is ever
  -- added, but nothing in the application sets it.
  launch_mode text not null default 'paused'
    check (launch_mode in ('draft', 'paused', 'active')),

  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed', 'blocked')),

  -- What Meta gave back, when it got far enough to give anything back.
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  meta_creative_id text,

  -- The full request payload, minus credentials, so a failed launch can be
  -- diagnosed without replaying it against the live account.
  request_payload jsonb not null default '{}'::jsonb,

  -- Meta's own error shape (code / subcode / message), stored verbatim.
  -- Never contains the access token: the client strips it before logging.
  error_detail jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meta_launch_attempts_concept_id_idx
  on public.meta_launch_attempts (concept_id, created_at desc);

alter table public.meta_launch_attempts enable row level security;

drop policy if exists "Users can view their own launch attempts" on public.meta_launch_attempts;
create policy "Users can view their own launch attempts"
  on public.meta_launch_attempts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own launch attempts" on public.meta_launch_attempts;
create policy "Users can insert their own launch attempts"
  on public.meta_launch_attempts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own launch attempts" on public.meta_launch_attempts;
create policy "Users can update their own launch attempts"
  on public.meta_launch_attempts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Deliberately no delete policy: an audit log of money-spending actions should
-- not be erasable from the application.

drop trigger if exists set_meta_launch_attempts_updated_at on public.meta_launch_attempts;
create trigger set_meta_launch_attempts_updated_at
  before update on public.meta_launch_attempts
  for each row execute function public.set_updated_at();
