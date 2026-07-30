-- creative_metrics was accumulating a duplicate set of rows on every sync.
--
-- The unique constraint was (concept_id, meta_entity_id, window_days), and
-- Postgres treats NULLs as distinct in a unique constraint — so for an ad with
-- no confirmed attribution, concept_id IS NULL never matched an existing row and
-- the upsert inserted instead of updating. Two syncs produced two full sets:
-- 38 creatives became 76, each appearing twice with slightly different scores.
--
-- The real identity of a row here is the ad and the window. Which concept it is
-- attributed to is derived data that can change — and does, the moment someone
-- confirms a link — so it never belonged in the key.

-- Collapse what is already there, keeping the most recently computed row per
-- (meta_entity_id, window_days).
delete from public.creative_metrics cm
where cm.id not in (
  select distinct on (meta_entity_id, window_days) id
  from public.creative_metrics
  order by meta_entity_id, window_days, computed_at desc
);

alter table public.creative_metrics
  drop constraint if exists creative_metrics_concept_id_meta_entity_id_window_days_key;

create unique index if not exists creative_metrics_entity_window_key
  on public.creative_metrics (meta_entity_id, window_days);
