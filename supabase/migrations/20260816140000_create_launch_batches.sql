-- Batch launching: one campaign and ad set, many ads.
--
-- Persisted rather than kept in the form because a batch of thirty ads fails
-- in parts. Meta rejects one creative for a policy reason, another for a
-- missing image, and the rest go through — without a record of which is which
-- the only recovery is to compare Ads Manager against memory.
--
-- Safe to re-run.

create table if not exists public.launch_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  ad_account_id text not null,

  -- Meta ids, filled as each object is created. Null means that step never
  -- got there, which is what makes a partial failure legible.
  campaign_meta_id text,
  adset_meta_id text,
  page_id text,

  -- What was asked for, kept so a failed batch can be retried without
  -- retyping. Meta's own objects are the source of truth once created.
  campaign_name text,
  adset_name text,
  objective text,
  daily_budget_minor int,
  countries text[] not null default '{}',
  age_min int,
  age_max int,
  start_time timestamptz,
  pixel_id text,
  custom_event_type text,

  -- Ads are created PAUSED unless explicitly asked otherwise, and which was
  -- chosen is worth recording — "did I launch that live?" is not a question
  -- anyone should have to answer from memory.
  ad_status text not null default 'PAUSED' check (ad_status in ('PAUSED', 'ACTIVE')),
  dry_run boolean not null default false,

  status text not null check (
    status in ('draft', 'running', 'completed', 'partial', 'failed')
  ),
  error text,

  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists launch_batches_user_idx
  on public.launch_batches (user_id, created_at desc);

alter table public.launch_batches enable row level security;

drop policy if exists "Users manage their own launch batches" on public.launch_batches;
create policy "Users manage their own launch batches"
  on public.launch_batches for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.launch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.launch_batches (id) on delete cascade,

  position int not null,

  -- The ad's own content.
  ad_name text not null,
  primary_text text not null,
  headline text not null,
  description text,
  call_to_action text not null default 'SHOP_NOW',
  link_url text not null,
  image_url text not null,
  -- Set when this ad came from a generated concept, so performance can be
  -- attributed back without relying on the name alone.
  concept_id uuid references public.ad_concepts (id) on delete set null,

  -- Meta ids as each step succeeds.
  image_hash text,
  creative_meta_id text,
  ad_meta_id text,

  status text not null default 'pending' check (
    status in ('pending', 'uploading', 'creating', 'done', 'failed', 'skipped')
  ),
  error text,
  -- Meta's subcode, so a whole batch failing for one reason is obvious at a
  -- glance rather than by reading thirty messages.
  error_subcode int,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (batch_id, position)
);

create index if not exists launch_items_batch_idx
  on public.launch_items (batch_id, position);

alter table public.launch_items enable row level security;

drop policy if exists "Users manage their own launch items" on public.launch_items;
create policy "Users manage their own launch items"
  on public.launch_items for all
  using (
    exists (
      select 1 from public.launch_batches b
      where b.id = launch_items.batch_id and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.launch_batches b
      where b.id = launch_items.batch_id and b.user_id = auth.uid()
    )
  );
