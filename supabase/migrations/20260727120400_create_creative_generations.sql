-- Brand Assets system, phase 1: one row per generation ATTEMPT (not per concept),
-- giving retry history, QA scores, and status tracking. ad_concepts.creative_image_path
-- keeps pointing at the latest/best image (unchanged, existing rendering path);
-- this table is the fuller audit trail behind it.
-- Safe to re-run: "create table if not exists" / "drop policy if exists" throughout.

create table if not exists public.creative_generations (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references public.ad_concepts (id) on delete cascade,
  attempt_number int not null default 1,
  status text not null default 'queued' check (
    status in (
      'queued', 'generating', 'generated', 'qa_in_progress', 'qa_failed',
      'retrying', 'needs_review', 'approved', 'rejected',
      'ready_for_publishing', 'published', 'failed'
    )
  ),
  image_path text,
  selected_reference_roles text[] not null default '{}',
  qa_scores jsonb,
  qa_passed boolean,
  qa_notes text,
  retry_reason text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creative_generations enable row level security;

-- Indirect ownership through ad_concepts, same shape as competitor_ads -> competitors.
drop policy if exists "Users can view their own creative generations" on public.creative_generations;
create policy "Users can view their own creative generations"
  on public.creative_generations for select
  using (
    exists (
      select 1 from public.ad_concepts ac
      where ac.id = creative_generations.concept_id
        and ac.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert their own creative generations" on public.creative_generations;
create policy "Users can insert their own creative generations"
  on public.creative_generations for insert
  with check (
    exists (
      select 1 from public.ad_concepts ac
      where ac.id = creative_generations.concept_id
        and ac.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their own creative generations" on public.creative_generations;
create policy "Users can update their own creative generations"
  on public.creative_generations for update
  using (
    exists (
      select 1 from public.ad_concepts ac
      where ac.id = creative_generations.concept_id
        and ac.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.ad_concepts ac
      where ac.id = creative_generations.concept_id
        and ac.user_id = auth.uid()
    )
  );

drop trigger if exists set_creative_generations_updated_at on public.creative_generations;
create trigger set_creative_generations_updated_at
  before update on public.creative_generations
  for each row execute function public.set_updated_at();
