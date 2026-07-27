-- Brand Assets system, phase 1: generic multi-asset table replacing the single
-- logo_image_url column for new assets. logo_image_url is kept (not dropped) for
-- backward compatibility — see the backfill below and the fallback read logic in
-- ad-concepts-repository.ts's getPrimaryLogoAsset().
-- Safe to re-run: "create table if not exists" / "drop policy if exists" throughout.

create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid not null references public.brand_profiles (id) on delete cascade,
  asset_type text not null check (
    asset_type in (
      'logo', 'icon', 'packaging', 'business_card', 'thank_you_card',
      'shopping_bag', 'storefront', 'other'
    )
  ),
  label text,
  image_url text not null,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  region text,
  season text,
  sort_order int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brand_assets enable row level security;

-- Indirect ownership through brand_profiles, same shape as competitor_ads -> competitors.
drop policy if exists "Users can view their own brand assets" on public.brand_assets;
create policy "Users can view their own brand assets"
  on public.brand_assets for select
  using (
    exists (
      select 1 from public.brand_profiles bp
      where bp.id = brand_assets.brand_profile_id
        and bp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert their own brand assets" on public.brand_assets;
create policy "Users can insert their own brand assets"
  on public.brand_assets for insert
  with check (
    exists (
      select 1 from public.brand_profiles bp
      where bp.id = brand_assets.brand_profile_id
        and bp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their own brand assets" on public.brand_assets;
create policy "Users can update their own brand assets"
  on public.brand_assets for update
  using (
    exists (
      select 1 from public.brand_profiles bp
      where bp.id = brand_assets.brand_profile_id
        and bp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.brand_profiles bp
      where bp.id = brand_assets.brand_profile_id
        and bp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their own brand assets" on public.brand_assets;
create policy "Users can delete their own brand assets"
  on public.brand_assets for delete
  using (
    exists (
      select 1 from public.brand_profiles bp
      where bp.id = brand_assets.brand_profile_id
        and bp.user_id = auth.uid()
    )
  );

-- Only one primary asset per (brand_profile_id, asset_type).
drop index if exists brand_assets_one_primary_per_type;
create unique index brand_assets_one_primary_per_type
  on public.brand_assets (brand_profile_id, asset_type)
  where is_primary;

drop trigger if exists set_brand_assets_updated_at on public.brand_assets;
create trigger set_brand_assets_updated_at
  before update on public.brand_assets
  for each row execute function public.set_updated_at();

-- Backfill: carry forward any existing logo_image_url into brand_assets so the
-- new asset manager immediately shows it, without touching the old column.
insert into public.brand_assets (brand_profile_id, asset_type, label, image_url, is_primary, is_active)
select bp.id, 'logo', 'Logo', bp.logo_image_url, true, true
from public.brand_profiles bp
where bp.logo_image_url is not null
  and not exists (
    select 1 from public.brand_assets ba
    where ba.brand_profile_id = bp.id and ba.asset_type = 'logo'
  );
