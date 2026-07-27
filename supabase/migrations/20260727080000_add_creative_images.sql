-- Creative Generator: per-concept AI-generated image, stored in Supabase Storage.

alter table public.ad_concepts
  add column if not exists creative_image_path text;

-- ad_concepts previously had no update policy — nothing updated a concept row
-- in place before this feature (regenerating an image overwrites the path).
drop policy if exists "Users can update their own ad concepts" on public.ad_concepts;
create policy "Users can update their own ad concepts"
  on public.ad_concepts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('ad-creative-images', 'ad-creative-images', false)
on conflict (id) do nothing;

-- Object paths are prefixed "{user_id}/...", so the first path segment doubles
-- as the ownership column RLS elsewhere expresses via user_id directly.
drop policy if exists "Users can view their own creative images" on storage.objects;
create policy "Users can view their own creative images"
  on storage.objects for select
  using (
    bucket_id = 'ad-creative-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can upload their own creative images" on storage.objects;
create policy "Users can upload their own creative images"
  on storage.objects for insert
  with check (
    bucket_id = 'ad-creative-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own creative images" on storage.objects;
create policy "Users can update their own creative images"
  on storage.objects for update
  using (
    bucket_id = 'ad-creative-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
