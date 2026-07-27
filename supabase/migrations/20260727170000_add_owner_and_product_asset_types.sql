-- Brand Assets: two asset types that carry the parts of a creative the model
-- must not invent — the brand's owner, and a real product.
-- Safe to re-run: the constraint is dropped by name before being recreated, and
-- widening it can never invalidate an existing row.
--
-- 'owner': brands whose creatives feature a real person need that person to be
-- the same person every time. Without a reference the model invents a new face
-- per generation — a male craftsman one run, someone else the next.
--
-- 'product': product photography already existed as a per-concept pasted URL
-- (ad_concepts.product_image_url). That stays and still wins when set, but it
-- has to be re-pasted for every concept. As an asset type the store's real
-- pieces become a library the pipeline can draw from on its own.

alter table public.brand_assets
  drop constraint if exists brand_assets_asset_type_check;

alter table public.brand_assets
  add constraint brand_assets_asset_type_check
  check (
    asset_type in (
      'logo', 'icon', 'packaging', 'business_card', 'thank_you_card',
      'shopping_bag', 'storefront', 'owner', 'product', 'other'
    )
  );
