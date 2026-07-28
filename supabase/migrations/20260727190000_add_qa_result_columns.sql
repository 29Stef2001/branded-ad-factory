-- Image QA: the verdict, not just the per-dimension scores.
-- Safe to re-run: "add column if not exists" throughout, no destructive changes.
--
-- qa_scores (jsonb) already held the ten dimension scores. What was missing is
-- everything you need to triage a render without opening the JSON: one overall
-- number, the concrete problems found, when it was judged, and the prompt that
-- would fix it.

alter table public.creative_generations
  -- 0-10, weighted across the dimensions in qa_scores. Numeric rather than int
  -- because the weighting produces fractions and rounding away 6.4 vs 6.6 loses
  -- exactly the resolution a pass threshold depends on.
  add column if not exists qa_score numeric(4, 2),
  add column if not exists detected_issues text[] not null default '{}',
  add column if not exists reviewed_at timestamptz,
  -- QA proposes a corrected prompt; applying it stays a human decision, so it
  -- is stored beside the attempt rather than written back onto the concept.
  add column if not exists qa_suggested_prompt text;

-- History views filter to the attempts that failed review, per concept.
create index if not exists creative_generations_qa_passed_idx
  on public.creative_generations (concept_id, qa_passed);
