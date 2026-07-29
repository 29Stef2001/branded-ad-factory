-- Creative Intelligence, phase 1: performance ingestion, attribution and scoring.
--
-- This is the platform's single source of truth for advertising performance.
-- Every later module (Creative Generator, Competitor Intelligence, Winning Ads,
-- Campaigns, Daily Batch Generation) reads its performance facts, attribution
-- and learnings from these tables rather than keeping its own copy.
--
-- Safe to re-run: "if not exists" / "drop policy if exists" throughout.

-- ---------------------------------------------------------------------------
-- Concept codes: the deterministic attribution key.
-- ---------------------------------------------------------------------------
-- The user names a Meta ad "CS-ABC234 — whatever", and ingestion parses the
-- code straight back to a concept. Perceptual hashing and manual linking exist
-- as fallbacks, but this is the path that is exact.
--
-- Crockford base32 without I, L, O and U: unambiguous when read off a screen
-- and typed into Ads Manager, and no accidental words.

create or replace function public.generate_concept_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  candidate text;
  i int;
begin
  loop
    candidate := 'CS-';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    -- 32^6 ≈ 1.07e9 combinations; the retry loop makes a collision a non-event
    -- rather than a constraint violation surfacing in the user's face.
    exit when not exists (
      select 1 from public.ad_concepts where concept_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

alter table public.ad_concepts
  add column if not exists concept_code text;

-- Backfill before the unique index, so existing concepts are attributable too.
update public.ad_concepts
set concept_code = public.generate_concept_code()
where concept_code is null;

alter table public.ad_concepts
  alter column concept_code set default public.generate_concept_code();

create unique index if not exists ad_concepts_concept_code_key
  on public.ad_concepts (concept_code);

alter table public.ad_concepts
  add column if not exists origin text not null default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ad_concepts_origin_check'
  ) then
    alter table public.ad_concepts
      add constraint ad_concepts_origin_check
      check (origin in ('manual', 'recommendation', 'batch'));
  end if;
end $$;

-- Recorded at upload time so perceptual-hash fallback matching is possible
-- later without re-downloading every creative.
alter table public.creative_generations
  add column if not exists perceptual_hash text;

-- ---------------------------------------------------------------------------
-- meta_ad_entities — the account mirror
-- ---------------------------------------------------------------------------
create table if not exists public.meta_ad_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  entity_type text not null check (entity_type in ('campaign', 'adset', 'ad')),
  meta_id text not null,
  parent_meta_id text,
  name text not null,
  status text,
  effective_status text,

  -- Ad-level creative identity, for attribution.
  creative_meta_id text,
  image_hash text,
  thumbnail_url text,
  perceptual_hash text,

  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, meta_id)
);

create index if not exists meta_ad_entities_user_type_idx
  on public.meta_ad_entities (user_id, entity_type, status);
create index if not exists meta_ad_entities_parent_idx
  on public.meta_ad_entities (user_id, parent_meta_id);
create index if not exists meta_ad_entities_phash_idx
  on public.meta_ad_entities (perceptual_hash)
  where perceptual_hash is not null;

alter table public.meta_ad_entities enable row level security;

drop policy if exists "Users manage their own meta ad entities" on public.meta_ad_entities;
create policy "Users manage their own meta ad entities"
  on public.meta_ad_entities for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- creative_links — attribution between a Meta ad and one of our concepts
-- ---------------------------------------------------------------------------
-- Its own table rather than a column on meta_ad_entities: one concept can run
-- as several ads, and how the link was made is worth keeping.

create table if not exists public.creative_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  meta_entity_id uuid not null references public.meta_ad_entities (id) on delete cascade,
  concept_id uuid not null references public.ad_concepts (id) on delete cascade,
  generation_id uuid references public.creative_generations (id) on delete set null,

  match_method text not null check (
    match_method in ('concept_code', 'perceptual_hash', 'manual', 'api_created')
  ),
  match_confidence numeric(4, 3) not null check (match_confidence between 0 and 1),
  -- Only confirmed links feed scoring. A wrong link teaches a false lesson
  -- with full confidence, which is worse than a missing one.
  confirmed boolean not null default false,
  confirmed_at timestamptz,

  created_at timestamptz not null default now(),
  unique (meta_entity_id, concept_id)
);

create index if not exists creative_links_concept_idx
  on public.creative_links (user_id, concept_id);
create index if not exists creative_links_unconfirmed_idx
  on public.creative_links (user_id, confirmed)
  where confirmed = false;

alter table public.creative_links enable row level security;

drop policy if exists "Users manage their own creative links" on public.creative_links;
create policy "Users manage their own creative links"
  on public.creative_links for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ad_insights_daily — the fact table
-- ---------------------------------------------------------------------------
-- Partitioned by month from the start. Retrofitting partitioning onto a live
-- table of hundreds of millions of rows is a migration nobody wants; declaring
-- it now costs one line.
--
-- Rates (CTR, CPC, CPM, ROAS) are deliberately absent: they are derived at
-- query time from the sums. Storing them invites averaging averages, and the
-- mean of daily CTRs is not the CTR of the period.

create table if not exists public.ad_insights_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  meta_entity_id uuid not null references public.meta_ad_entities (id) on delete cascade,
  stat_date date not null,

  -- Delivery
  impressions bigint not null default 0,
  reach bigint not null default 0,
  frequency numeric(8, 4),
  spend numeric(14, 4) not null default 0,

  -- Engagement
  clicks bigint not null default 0,
  link_clicks bigint not null default 0,
  outbound_clicks bigint not null default 0,
  landing_page_views bigint not null default 0,
  post_engagements bigint not null default 0,

  -- Conversion (Pixel / CAPI)
  purchases bigint not null default 0,
  revenue numeric(14, 4) not null default 0,
  add_to_cart bigint not null default 0,
  add_to_cart_value numeric(14, 4) not null default 0,
  initiate_checkout bigint not null default 0,
  initiate_checkout_value numeric(14, 4) not null default 0,
  leads bigint not null default 0,
  registrations bigint not null default 0,

  -- Video
  video_plays bigint not null default 0,
  video_p25 bigint not null default 0,
  video_p50 bigint not null default 0,
  video_p75 bigint not null default 0,
  video_p100 bigint not null default 0,
  video_thruplays bigint not null default 0,

  -- Meta restates recent days for up to ~28 days as attribution settles, so a
  -- row is only trusted as final once it has aged out of that window.
  is_final boolean not null default false,
  synced_at timestamptz not null default now(),

  primary key (meta_entity_id, stat_date)
) partition by range (stat_date);

create index if not exists ad_insights_daily_user_date_idx
  on public.ad_insights_daily (user_id, stat_date);

alter table public.ad_insights_daily enable row level security;

drop policy if exists "Users manage their own ad insights" on public.ad_insights_daily;
create policy "Users manage their own ad insights"
  on public.ad_insights_daily for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Creates the partition covering a given month, if it does not exist.
-- Called by the ingestion job before writing, so a new month never fails.
create or replace function public.ensure_insights_partition(target date)
returns void
language plpgsql
as $$
declare
  start_date date := date_trunc('month', target)::date;
  end_date date := (date_trunc('month', target) + interval '1 month')::date;
  partition_name text := 'ad_insights_daily_' || to_char(start_date, 'YYYYMM');
begin
  if not exists (
    select 1 from pg_class where relname = partition_name
  ) then
    execute format(
      'create table public.%I partition of public.ad_insights_daily for values from (%L) to (%L)',
      partition_name, start_date, end_date
    );
  end if;
end;
$$;

-- Cover the trailing year and the next month, so the first sync has somewhere
-- to land and the next month rollover is not a surprise.
do $$
declare
  m date;
begin
  for m in
    select generate_series(
      date_trunc('month', now() - interval '12 months'),
      date_trunc('month', now() + interval '1 month'),
      interval '1 month'
    )::date
  loop
    perform public.ensure_insights_partition(m);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- creative_metrics — the rollup that scoring and every dashboard reads
-- ---------------------------------------------------------------------------
-- A table rather than a view: at scale, a view over hundreds of millions of
-- daily rows is not something to put on a page render path.

create table if not exists public.creative_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  concept_id uuid references public.ad_concepts (id) on delete cascade,
  meta_entity_id uuid references public.meta_ad_entities (id) on delete cascade,
  -- 0 = lifetime
  window_days int not null check (window_days in (7, 14, 30, 90, 0)),

  -- Sums, carried forward from the facts.
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  link_clicks bigint not null default 0,
  spend numeric(14, 4) not null default 0,
  purchases bigint not null default 0,
  revenue numeric(14, 4) not null default 0,
  add_to_cart bigint not null default 0,
  initiate_checkout bigint not null default 0,
  landing_page_views bigint not null default 0,

  -- Derived rates, written by the scoring job.
  ctr numeric(10, 6),
  ctr_lower_bound numeric(10, 6),
  link_ctr numeric(10, 6),
  cpc numeric(14, 4),
  cpm numeric(14, 4),
  cpa numeric(14, 4),
  roas numeric(12, 4),
  roas_shrunk numeric(12, 4),
  conversion_rate numeric(10, 6),

  composite_score numeric(6, 3),
  -- Which metric the composite leaned on, so the UI never presents a CTR
  -- ranking as if it were a revenue ranking.
  primary_metric text check (primary_metric in ('roas', 'cpa', 'ctr')),
  evidence_tier text not null check (
    evidence_tier in ('insufficient', 'directional', 'confident')
  ),
  percentile_rank numeric(6, 5),

  window_start date,
  window_end date,
  computed_at timestamptz not null default now(),

  unique (concept_id, meta_entity_id, window_days)
);

create index if not exists creative_metrics_ranking_idx
  on public.creative_metrics (user_id, window_days, composite_score desc nulls last);
create index if not exists creative_metrics_concept_idx
  on public.creative_metrics (user_id, concept_id);

alter table public.creative_metrics enable row level security;

drop policy if exists "Users manage their own creative metrics" on public.creative_metrics;
create policy "Users manage their own creative metrics"
  on public.creative_metrics for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- job_runs — the ledger every background job claims and checkpoints against
-- ---------------------------------------------------------------------------
-- No job may assume it can finish in one invocation: Vercel Hobby caps
-- functions at 60s regardless of maxDuration, which image generation has
-- already hit. Jobs process a chunk, write a cursor, and resume on the next
-- run — which is also what makes them work at a million creatives.

create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  job_name text not null,
  status text not null check (status in ('running', 'succeeded', 'failed', 'partial')),
  trigger text not null check (trigger in ('cron', 'manual')),

  -- Where to resume from when a run could not finish in one invocation.
  cursor jsonb,
  processed_count int not null default 0,
  error text,

  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists job_runs_lookup_idx
  on public.job_runs (user_id, job_name, started_at desc);
-- At most one live run per job per user: the guard that stops two overlapping
-- cron invocations both ingesting the same window.
create unique index if not exists job_runs_single_active_idx
  on public.job_runs (user_id, job_name)
  where status = 'running';

alter table public.job_runs enable row level security;

drop policy if exists "Users manage their own job runs" on public.job_runs;
create policy "Users manage their own job runs"
  on public.job_runs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
