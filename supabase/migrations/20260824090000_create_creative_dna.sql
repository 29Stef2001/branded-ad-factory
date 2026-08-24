-- Creative DNA: what a creative *is*, so performance can be explained.
--
-- Scoring already says which creative won. This says why it might have, in
-- terms that group: hook type, angle, awareness level, composition, proof,
-- offer pattern. The point is not to describe one ad — it is to be able to ask,
-- after five hundred of them, which hooks win structurally.
--
-- Everything is a closed vocabulary rather than free text. Free text cannot be
-- grouped, and grouping is the entire purpose.

create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  analysis_type text not null check (
    analysis_type in ('creative_dna', 'winner', 'hook', 'offer', 'visual', 'recommendation')
  ),
  subject_type text not null,
  subject_id uuid,

  model text not null,
  -- Bumped when the prompt changes, which is what invalidates cached results.
  prompt_version text not null,
  -- Identical inputs are never paid for twice.
  input_hash text not null,

  status text not null check (status in ('running', 'succeeded', 'failed')),
  input_tokens int,
  output_tokens int,
  duration_ms int,
  error text,
  result jsonb,

  created_at timestamptz not null default now()
);

create index if not exists analysis_runs_lookup_idx
  on public.analysis_runs (user_id, analysis_type, created_at desc);

-- One succeeded result per (type, prompt version, input). Re-analysing the
-- same creative with the same prompt is a bill, not a new finding.
create unique index if not exists analysis_runs_cache_idx
  on public.analysis_runs (user_id, analysis_type, prompt_version, input_hash)
  where status = 'succeeded';

alter table public.analysis_runs enable row level security;

drop policy if exists "Users manage their own analysis runs" on public.analysis_runs;
create policy "Users manage their own analysis runs"
  on public.analysis_runs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.creative_features (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- A Meta ad, which is what has performance. Concepts this app generated are
  -- linked through creative_links and inherit their ad's features.
  meta_entity_id uuid not null references public.meta_ad_entities (id) on delete cascade,

  -- What the ad is doing, in groupable terms.
  hook_type text,
  hook_text text,
  angle text,
  awareness_level text,
  offer_type text,
  offer_strength text,
  emotional_driver text,

  -- What it looks like.
  format text,
  composition text,
  visual_pattern text,
  has_person boolean,
  shows_product boolean,
  text_on_image boolean,
  proof_type text,
  dominant_colors text[],
  brightness text,

  -- Why it might be working, in the model's words. Free text on purpose: this
  -- one is for a human to read, not to group by.
  why_it_works text[],

  analysis_run_id uuid references public.analysis_runs (id) on delete set null,
  -- Of the inputs, so an unchanged creative is not re-analysed.
  content_hash text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (meta_entity_id)
);

create index if not exists creative_features_hook_idx
  on public.creative_features (user_id, hook_type);
create index if not exists creative_features_angle_idx
  on public.creative_features (user_id, angle);
create index if not exists creative_features_offer_idx
  on public.creative_features (user_id, offer_type);
create index if not exists creative_features_pattern_idx
  on public.creative_features (user_id, visual_pattern);

alter table public.creative_features enable row level security;

drop policy if exists "Users manage their own creative features" on public.creative_features;
create policy "Users manage their own creative features"
  on public.creative_features for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
