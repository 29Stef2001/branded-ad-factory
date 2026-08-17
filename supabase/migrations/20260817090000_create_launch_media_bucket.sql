-- Storage for creatives uploaded straight into a launch.
--
-- Its own bucket rather than reusing ad-creative-images, which holds what the
-- generator produced and what QA judged. These are files the user made
-- elsewhere and is launching as they are — mixing them would make "everything
-- this app generated" impossible to ask for.
--
-- Private, with ownership in the path prefix, exactly like the other two
-- buckets: the first path segment is the user id, which is what the policies
-- match on.

insert into storage.buckets (id, name, public)
values ('launch-media', 'launch-media', false)
on conflict (id) do nothing;

drop policy if exists "Users can view their own launch media" on storage.objects;
create policy "Users can view their own launch media"
  on storage.objects for select
  using (
    bucket_id = 'launch-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can upload their own launch media" on storage.objects;
create policy "Users can upload their own launch media"
  on storage.objects for insert
  with check (
    bucket_id = 'launch-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can replace their own launch media" on storage.objects;
create policy "Users can replace their own launch media"
  on storage.objects for update
  using (
    bucket_id = 'launch-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their own launch media" on storage.objects;
create policy "Users can delete their own launch media"
  on storage.objects for delete
  using (
    bucket_id = 'launch-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
