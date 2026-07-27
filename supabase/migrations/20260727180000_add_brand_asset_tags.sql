-- Brand Assets: free-form tags alongside the fixed asset_type.
-- Safe to re-run: "add column if not exists", no destructive changes.
--
-- asset_type answers "what is this a photo of" and stays a closed set. Tags
-- answer everything that cuts across it — a photo of the owner in her workshop
-- is also lifestyle, also candid, also winter. Forcing those into asset_type
-- would mean picking one and losing the rest.
--
-- NOT NULL with a default so every existing row becomes a valid empty array
-- rather than null, which keeps the scorer from having to handle both.

alter table public.brand_assets
  add column if not exists tags text[] not null default '{}';

-- Tag filtering is a containment test (does this asset carry any of these
-- tags), which is what GIN indexes are for.
create index if not exists brand_assets_tags_idx
  on public.brand_assets using gin (tags);
