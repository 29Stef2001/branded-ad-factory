-- Brand DNA: the structured brand model every AI module reads from.
-- Safe to re-run: "add column if not exists" throughout, constraints dropped by
-- name before being recreated, and the backfill only writes where the target is
-- still empty.
--
-- Expand-contract on purpose. The superseded columns (industry, tone,
-- unique_selling_points) are left in place here and dropped in a later
-- migration, so applying this while the old code is still running cannot break
-- anything. Nothing reads them once the new code ships.
--
-- Everything is nullable or defaulted: an existing profile stays valid without
-- anyone filling in twenty new fields, and a future store_id migration has no
-- NOT NULL columns to backfill around.

alter table public.brand_profiles
  -- ── Provenance ──────────────────────────────────────────────────────────
  -- Which shape of the model this row was written against. A later migration
  -- can find rows it still needs to convert instead of guessing from which
  -- columns happen to be null. updated_at already exists, with a trigger.
  add column if not exists schema_version int not null default 1,
  add column if not exists updated_by uuid references auth.users (id),
  -- How the current values got here: 'legacy_backfill' for rows this migration
  -- converted, 'form' once a human has saved over them. Distinguishes "never
  -- reviewed" from "deliberately left as-is", which no other column can.
  add column if not exists migration_source text,

  -- Experimental fields that do not deserve a column yet. Deliberately NOT fed
  -- into any prompt: anything a model is told about the brand comes from a
  -- typed field, so an arbitrary key cannot silently change generated output.
  add column if not exists metadata jsonb not null default '{}'::jsonb,

  -- ── Identity ────────────────────────────────────────────────────────────
  add column if not exists brand_category text,
  -- Arrays rather than a single value: a brand can sell into more than one
  -- market, and the language rule in the prompts is derived from this.
  add column if not exists markets text[] not null default '{US}',
  add column if not exists languages text[] not null default '{en}',
  add column if not exists brand_story text,
  add column if not exists brand_mission text,

  -- ── Voice ───────────────────────────────────────────────────────────────
  -- Split from the old free-text `tone`: the attributes are what a model can
  -- act on consistently, the notes carry whatever does not fit a list.
  add column if not exists tone_attributes text[] not null default '{}',
  add column if not exists tone_notes text,
  add column if not exists writing_style text,

  -- ── Visual ──────────────────────────────────────────────────────────────
  add column if not exists visual_style text,
  add column if not exists photography_style text,
  add column if not exists logo_rules text,

  -- ── Founder ─────────────────────────────────────────────────────────────
  -- No photo column: the founder's image lives in brand_assets as an 'owner'
  -- asset, where the reference-selection pipeline already picks it up. Storing
  -- it here too would create exactly the second source of truth this model
  -- exists to remove.
  add column if not exists founder_name text,
  add column if not exists founder_gender text,
  add column if not exists founder_age int,
  add column if not exists founder_background text,

  -- ── Commercial ──────────────────────────────────────────────────────────
  add column if not exists product_positioning text,
  add column if not exists price_positioning text,
  add column if not exists materials text[] not null default '{}',
  add column if not exists usps text[] not null default '{}',
  add column if not exists brand_values text[] not null default '{}',

  -- ── Language rules ──────────────────────────────────────────────────────
  add column if not exists words_to_always_use text[] not null default '{}',
  add column if not exists words_to_never_use text[] not null default '{}',

  -- ── Generation rules ────────────────────────────────────────────────────
  add column if not exists image_generation_rules text,
  add column if not exists copy_generation_rules text,
  add column if not exists qa_expectations text,
  -- Overrides the application's default pass mark when set, so a brand can be
  -- stricter than the shared threshold without a code change.
  add column if not exists qa_min_score numeric(4, 2);

-- Fixed vocabularies are CHECK constraints rather than Postgres enum types:
-- widening a CHECK is a drop-and-recreate in one migration, while ALTER TYPE
-- ... ADD VALUE cannot run in a transaction with other DDL. Null is always
-- allowed — these are optional fields, not required ones.
alter table public.brand_profiles
  drop constraint if exists brand_profiles_writing_style_check;
alter table public.brand_profiles
  add constraint brand_profiles_writing_style_check
  check (
    writing_style is null or writing_style in (
      'direct_response', 'conversational', 'editorial', 'minimal', 'storytelling'
    )
  );

alter table public.brand_profiles
  drop constraint if exists brand_profiles_photography_style_check;
alter table public.brand_profiles
  add constraint brand_profiles_photography_style_check
  check (
    photography_style is null or photography_style in (
      'documentary', 'ugc', 'studio', 'editorial', 'lifestyle', 'flat_lay'
    )
  );

alter table public.brand_profiles
  drop constraint if exists brand_profiles_founder_gender_check;
alter table public.brand_profiles
  add constraint brand_profiles_founder_gender_check
  check (
    founder_gender is null or founder_gender in (
      'female', 'male', 'non_binary', 'unspecified'
    )
  );

alter table public.brand_profiles
  drop constraint if exists brand_profiles_price_positioning_check;
alter table public.brand_profiles
  add constraint brand_profiles_price_positioning_check
  check (
    price_positioning is null or price_positioning in (
      'budget', 'mid_market', 'premium', 'luxury'
    )
  );

alter table public.brand_profiles
  drop constraint if exists brand_profiles_qa_min_score_check;
alter table public.brand_profiles
  add constraint brand_profiles_qa_min_score_check
  check (qa_min_score is null or (qa_min_score >= 0 and qa_min_score <= 10));

-- Backfill from the columns being superseded. Guarded so re-running never
-- overwrites something the user has since edited by hand.
update public.brand_profiles
set brand_category = industry
where brand_category is null and industry is not null;

update public.brand_profiles
set tone_notes = tone
where tone_notes is null and tone is not null;

-- The old USP field was one free-text blob. Splitting it on punctuation would
-- guess at the author's intent, so it becomes a single array entry that can be
-- split by hand — lossless, and obviously unfinished rather than silently wrong.
update public.brand_profiles
set usps = array[unique_selling_points]
where cardinality(usps) = 0
  and unique_selling_points is not null
  and length(trim(unique_selling_points)) > 0;

-- Marks the rows this migration converted, so a row that has never been
-- reviewed by a human is distinguishable from one deliberately left alone.
update public.brand_profiles
set migration_source = 'legacy_backfill'
where migration_source is null;

alter table public.brand_profiles
  drop constraint if exists brand_profiles_migration_source_check;
alter table public.brand_profiles
  add constraint brand_profiles_migration_source_check
  check (
    migration_source is null or migration_source in ('legacy_backfill', 'form', 'import')
  );
