-- Competitor ads become provider-generic.
--
-- The Meta Ad Library API turns out not to be a general competitor-ads
-- source: it only returns ads that reached the EU, or political/social-issue
-- ads — an ordinary e-commerce advertiser's ads have no path through this
-- endpoint at all, confirmed empirically. competitor_ads was designed as if
-- Meta were the only source (a NOT NULL UNIQUE meta_ad_archive_id), which
-- blocks any other provider from writing a row. This generalizes the table so
-- a public-web-research read, a paid ad-intelligence API, or a future
-- provider can all land ads in the same place, distinguished by
-- (source_provider, external_ad_id) instead of a Meta-only key.
--
-- Safe to re-run: "if not exists" / "drop constraint if exists" throughout.
-- No destructive drops — meta_ad_archive_id is relaxed, not removed, so
-- nothing that already reads it breaks.

alter table public.competitor_ads
  alter column meta_ad_archive_id drop not null;

alter table public.competitor_ads
  drop constraint if exists competitor_ads_meta_ad_archive_id_key;

alter table public.competitor_ads
  add column if not exists source_provider text not null default 'meta_ad_library';

alter table public.competitor_ads
  add column if not exists external_ad_id text;

-- One-time backfill for the column that replaces meta_ad_archive_id as the
-- dedup key. Harmless to re-run: only fills rows that don't have it yet.
update public.competitor_ads
set external_ad_id = meta_ad_archive_id
where external_ad_id is null and meta_ad_archive_id is not null;

-- New signals a provider may or may not be able to supply. All nullable —
-- "not available from this provider" is a real, expected state, not a gap to
-- fill in later.
alter table public.competitor_ads
  add column if not exists creative_image_url text;
alter table public.competitor_ads
  add column if not exists creative_video_url text;
alter table public.competitor_ads
  add column if not exists landing_page_url text;

create unique index if not exists competitor_ads_provider_external_id_key
  on public.competitor_ads (source_provider, external_ad_id)
  where external_ad_id is not null;

create index if not exists competitor_ads_provider_idx
  on public.competitor_ads (competitor_id, source_provider);

-- competitors.website_url: what PublicWebResearchProvider will eventually
-- read from. Added now, alongside the table it's most related to, even
-- though that provider isn't built yet — a nullable column costs nothing and
-- means the field exists the moment it's needed rather than requiring another
-- migration first.
alter table public.competitors
  add column if not exists website_url text;
