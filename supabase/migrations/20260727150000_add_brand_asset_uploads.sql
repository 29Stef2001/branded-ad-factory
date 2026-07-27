-- Brand Assets: let an asset be an uploaded file, not only a pasted URL.
-- Safe to re-run: "add column if not exists" / "drop policy if exists" throughout.
--
-- Pasted URLs only ever worked for a store whose images already live on a
-- public CDN, and the SSRF allowlist deliberately keeps that narrow. Uploading
-- covers everything else — packaging photos, storefront shots, business cards —
-- none of which is likely to be sitting on a Shopify CDN already.

alter table public.brand_assets
  add column if not exists storage_path text;

-- image_url stops being mandatory: an uploaded asset has a storage_path
-- instead. Dropping a NOT NULL never invalidates existing rows, so every asset
-- created before this migration stays exactly as it is.
alter table public.brand_assets
  alter column image_url drop not null;

-- Exactly one source per asset, enforced in the database rather than trusted
-- from the application: an asset with neither is unrenderable, and one with
-- both is ambiguous about which wins.
alter table public.brand_assets
  drop constraint if exists brand_assets_one_image_source;
alter table public.brand_assets
  add constraint brand_assets_one_image_source
  check (num_nonnulls(image_url, storage_path) = 1);

insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', false)
on conflict (id) do nothing;

-- Private, like ad-creative-images: object paths are prefixed "{user_id}/", so
-- the first path segment carries ownership the way user_id does elsewhere.
drop policy if exists "Users can view their own brand assets storage" on storage.objects;
create policy "Users can view their own brand assets storage"
  on storage.objects for select
  using (
    bucket_id = 'brand-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can upload their own brand assets storage" on storage.objects;
create policy "Users can upload their own brand assets storage"
  on storage.objects for insert
  with check (
    bucket_id = 'brand-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own brand assets storage" on storage.objects;
create policy "Users can update their own brand assets storage"
  on storage.objects for update
  using (
    bucket_id = 'brand-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Deleting an asset row should not strand its file in the bucket, and the row
-- delete is what the application actually calls.
drop policy if exists "Users can delete their own brand assets storage" on storage.objects;
create policy "Users can delete their own brand assets storage"
  on storage.objects for delete
  using (
    bucket_id = 'brand-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
