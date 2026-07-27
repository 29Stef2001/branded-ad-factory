-- Creative Generator: lets the brand's real logo be composited into generated
-- scenes (e.g. embossed inside a jewelry box), instead of an invented emblem.

alter table public.brand_profiles
  add column if not exists logo_image_url text;
