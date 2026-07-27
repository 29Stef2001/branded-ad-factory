-- Concept Refiner: lets a concept be refined into a new concept row, linked
-- back to the original via a nullable, self-referential foreign key.
-- Safe to re-run: uses "add column if not exists", no destructive changes.
-- No RLS changes needed — existing ad_concepts policies already cover this column.

alter table public.ad_concepts
  add column if not exists refined_from_concept_id uuid
    references public.ad_concepts (id) on delete set null;
