-- Creative Generator (reference image): lets a concept point at a real product
-- photo so image generation composites the actual product instead of inventing one.

alter table public.ad_concepts
  add column if not exists product_image_url text;
