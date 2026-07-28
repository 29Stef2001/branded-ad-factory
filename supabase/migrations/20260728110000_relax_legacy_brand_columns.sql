-- Brand DNA follow-up: let the superseded columns go null.
-- Safe to re-run: dropping a NOT NULL that is already dropped is a no-op, and
-- no existing row is invalidated by widening what a column accepts.
--
-- industry, tone and unique_selling_points were NOT NULL from the original
-- schema. Their replacements (brand_category, tone_notes/tone_attributes, usps)
-- now carry the data and nothing writes the old columns any more — so every
-- save failed with 23502 the moment the new upsert stopped filling them.
--
-- They are kept rather than dropped so that applying this while older code is
-- still deployed cannot break it: that code can still read them. Dropping the
-- columns is a separate migration, once the new model has been running a while.

alter table public.brand_profiles
  alter column industry drop not null,
  alter column tone drop not null,
  alter column unique_selling_points drop not null;
