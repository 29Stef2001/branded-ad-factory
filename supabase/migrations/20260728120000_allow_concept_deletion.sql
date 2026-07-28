-- Concepts could be created but never removed: ad_concepts had select, insert
-- and update policies but no delete. A delete would have matched zero rows and
-- reported success, which is worse than refusing outright.
-- Safe to re-run: policy dropped by name before being recreated.
--
-- creative_generations already cascades from concept_id, so a concept's
-- generation history goes with it. Its stored images are removed by the
-- application, which knows the storage paths.

drop policy if exists "Users can delete their own ad concepts" on public.ad_concepts;
create policy "Users can delete their own ad concepts"
  on public.ad_concepts for delete
  using (auth.uid() = user_id);
