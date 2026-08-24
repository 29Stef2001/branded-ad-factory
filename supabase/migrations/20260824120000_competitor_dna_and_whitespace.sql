-- Competitor Creative DNA + whitespace synthesis.
--
-- competitor-analysis today produces free text (messaging_angle, hook, tone...)
-- that cannot be grouped the way creative_features can. This closes that gap:
-- a closed-vocabulary read on competitor ads, sharing the same vocabulary as
-- creative_features so "what do we do vs. what do they do" is a group-by, not
-- a guess. Text only — the Ad Library API gives no image, so there is no
-- composition/visual_pattern/brightness here, unlike creative_features.
--
-- Safe to re-run: "if not exists" / "drop ... if exists" throughout.

-- ---------------------------------------------------------------------------
-- competitors: track sync state, and where a competitor came from
-- ---------------------------------------------------------------------------
alter table public.competitors
  add column if not exists status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'competitors_status_check'
  ) then
    alter table public.competitors
      add constraint competitors_status_check
      check (status in ('active', 'archived'));
  end if;
end $$;

alter table public.competitors
  add column if not exists discovery_source text not null default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'competitors_discovery_source_check'
  ) then
    alter table public.competitors
      add constraint competitors_discovery_source_check
      check (discovery_source in ('manual', 'suggested'));
  end if;
end $$;

alter table public.competitors
  add column if not exists last_synced_at timestamptz;

-- ---------------------------------------------------------------------------
-- competitor_ads: first/last seen + active status
-- ---------------------------------------------------------------------------
-- Refreshing used to blindly overwrite every column, so "how long has this
-- angle been running" was unanswerable — a re-fetch looked identical to a
-- brand new ad. first_seen_at is set once and never touched again; last_seen_at
-- and is_active move on every refresh.

alter table public.competitor_ads
  add column if not exists ad_delivery_stop_time timestamptz;

alter table public.competitor_ads
  add column if not exists is_active boolean;

alter table public.competitor_ads
  add column if not exists first_seen_at timestamptz not null default now();

alter table public.competitor_ads
  add column if not exists last_seen_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- competitor_creative_features: the DNA read, text-only
-- ---------------------------------------------------------------------------
-- user_id is denormalized here (rather than reached only through
-- competitor_ads -> competitors) for the same reason creative_features
-- denormalizes it: the whitespace synthesis reads this table directly and
-- should not need a join back through two tables to enforce RLS.

create table if not exists public.competitor_creative_features (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  competitor_ad_id uuid not null references public.competitor_ads (id) on delete cascade,

  -- Shared vocabulary with creative_features (see
  -- creative-intelligence/domain/creative-dna.ts). Comparable across "ours"
  -- and "theirs" is the entire point; a separate vocabulary here would make
  -- the two sides two incomparable piles of free text, same as ad_analyses is
  -- today.
  hook_type text,
  hook_text text,
  angle text,
  awareness_level text,
  offer_type text,
  offer_strength text,
  emotional_driver text,

  -- Competitor-specific: text-only ad copy makes the CTA phrasing the one
  -- extra structured signal worth capturing that creative_features has no
  -- field for.
  cta_style text,

  -- What is literally in the copy vs. what is a reasoned judgement about it.
  -- Never presented as one flat assertion: Ad Library gives no spend/CPA/ROAS,
  -- so nothing here should read as a performance claim.
  observed_facts text[] not null default '{}',
  inferred_hypotheses text[] not null default '{}',

  -- Computed from text richness (word count), not self-reported by the model.
  -- Same reasoning as evidence_tier in scoring.ts: confidence is a fact about
  -- the input, never the model's opinion of its own output.
  confidence text not null,

  analysis_run_id uuid references public.analysis_runs (id) on delete set null,
  content_hash text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (competitor_ad_id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'competitor_creative_features_confidence_check'
  ) then
    alter table public.competitor_creative_features
      add constraint competitor_creative_features_confidence_check
      check (confidence in ('low', 'medium', 'high'));
  end if;
end $$;

create index if not exists competitor_creative_features_hook_idx
  on public.competitor_creative_features (user_id, hook_type);
create index if not exists competitor_creative_features_angle_idx
  on public.competitor_creative_features (user_id, angle);
create index if not exists competitor_creative_features_offer_idx
  on public.competitor_creative_features (user_id, offer_type);

alter table public.competitor_creative_features enable row level security;

drop policy if exists "Users manage their own competitor creative features" on public.competitor_creative_features;
create policy "Users manage their own competitor creative features"
  on public.competitor_creative_features for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- suggested_competitors: flagged, never auto-promoted
-- ---------------------------------------------------------------------------
-- A signal the system (or the user) noticed a possible competitor. Nothing
-- here ever becomes a row in competitors without an explicit approve.

create table if not exists public.suggested_competitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  name text not null,
  meta_page_id text,
  reason text not null,
  source text not null default 'manual_search',
  status text not null default 'pending',

  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'suggested_competitors_source_check'
  ) then
    alter table public.suggested_competitors
      add constraint suggested_competitors_source_check
      check (source in ('manual_search', 'angle_overlap'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'suggested_competitors_status_check'
  ) then
    alter table public.suggested_competitors
      add constraint suggested_competitors_status_check
      check (status in ('pending', 'approved', 'dismissed'));
  end if;
end $$;

create index if not exists suggested_competitors_pending_idx
  on public.suggested_competitors (user_id, status)
  where status = 'pending';

alter table public.suggested_competitors enable row level security;

drop policy if exists "Users manage their own suggested competitors" on public.suggested_competitors;
create policy "Users manage their own suggested competitors"
  on public.suggested_competitors for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- analysis_runs: two new cache-able analysis types
-- ---------------------------------------------------------------------------
-- Reuses the existing content-hash cache rather than inventing a parallel one
-- for competitor DNA and for the whitespace narrative.

alter table public.analysis_runs
  drop constraint if exists analysis_runs_analysis_type_check;

alter table public.analysis_runs
  add constraint analysis_runs_analysis_type_check
  check (
    analysis_type in (
      'creative_dna', 'winner', 'hook', 'offer', 'visual', 'recommendation',
      'competitor_dna', 'whitespace'
    )
  );
