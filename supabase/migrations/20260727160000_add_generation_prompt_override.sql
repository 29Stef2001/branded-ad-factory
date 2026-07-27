-- Prompt Builder: a hand-edited generation prompt, kept separate from the one
-- the model produced.
-- Safe to re-run: "add column if not exists", no destructive changes.
--
-- Editing could have overwritten final_generation_prompt directly, but then
-- "reset to the originally generated prompt" would be impossible — the original
-- would already be gone. Keeping the override in its own column means the
-- model's output survives every edit, and resetting is just clearing this one.
--
-- Null means "no edit"; generation falls back to final_generation_prompt, and
-- then to visual_direction for concepts that predate structured output.

alter table public.ad_concepts
  add column if not exists generation_prompt_override text;
