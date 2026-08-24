-- Automated competitor discovery: classification, relevance, and a website
-- to enrich against once a provider needs one, since discovery (brand-context
-- reasoning) rarely knows a competitor's exact Meta Page ID up front.
--
-- Safe to re-run: "if not exists" / "drop constraint if exists" throughout.

alter table public.suggested_competitors
  add column if not exists website_url text;

alter table public.suggested_competitors
  add column if not exists competitor_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'suggested_competitors_competitor_type_check'
  ) then
    alter table public.suggested_competitors
      add constraint suggested_competitors_competitor_type_check
      check (competitor_type in ('DIRECT', 'INDIRECT', 'ADJACENT', 'ASPIRATIONAL'));
  end if;
end $$;

-- 0-100: how confident the discovery reasoning is that this is a genuine,
-- relevant competitor. Not a probability in any calibrated sense — a
-- deliberately coarse signal for sorting the review queue, same spirit as
-- competitor_creative_features.confidence being low/medium/high rather than
-- a fake-precise float.
alter table public.suggested_competitors
  add column if not exists relevance_score int;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'suggested_competitors_relevance_score_check'
  ) then
    alter table public.suggested_competitors
      add constraint suggested_competitors_relevance_score_check
      check (relevance_score is null or (relevance_score >= 0 and relevance_score <= 100));
  end if;
end $$;

-- Distinct from `reason` (free text, used by the existing manual-flag flow):
-- this is the structured "why" an automated discovery run produced this
-- candidate — product/audience/category/positioning overlap — kept separate
-- so a manual flag's one-line reason and a discovery run's structured
-- reasoning don't collide into one ambiguous column.
alter table public.suggested_competitors
  add column if not exists relevance_reasoning text;

alter table public.suggested_competitors
  add column if not exists discovered_at timestamptz;

update public.suggested_competitors
set discovered_at = created_at
where discovered_at is null;
