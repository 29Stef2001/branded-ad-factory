-- Brand Assets system, phase 1: structured brand style settings.
-- Safe to re-run: "add column if not exists" throughout.

alter table public.brand_profiles
  add column if not exists brand_colors jsonb,
  add column if not exists typography_notes text,
  add column if not exists emboss_style text
    check (emboss_style in ('none', 'embossed', 'debossed', 'engraved', 'custom'))
    default 'none',
  add column if not exists emboss_custom_notes text,
  add column if not exists foil_style text
    check (foil_style in ('none', 'copper', 'gold', 'silver', 'custom'))
    default 'none',
  add column if not exists foil_custom_notes text;
