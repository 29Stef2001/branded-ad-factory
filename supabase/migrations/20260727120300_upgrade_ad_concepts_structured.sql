-- Brand Assets system, phase 1: structured concept fields (section 14 rewrite)
-- plus denormalized generation status for cheap list rendering.
-- Safe to re-run: "add column if not exists" throughout.

alter table public.ad_concepts
  add column if not exists strategy_type text
    check (strategy_type in ('control', 'close_variation', 'moderate_variation', 'exploration')),
  add column if not exists campaign_angle text,
  add column if not exists promotional_message_id uuid
    references public.approved_promotional_messages (id) on delete set null,
  add column if not exists brand_asset_requirements text[] not null default '{}',
  add column if not exists structured_concept jsonb,
  add column if not exists final_generation_prompt text,
  add column if not exists generation_status text,
  add column if not exists generation_retry_count int not null default 0;
