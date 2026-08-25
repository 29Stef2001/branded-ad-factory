-- Make the competitor-ad dedup index usable as an ON CONFLICT target.
--
-- Every upsert of a competitor ad failed with 42P10, "there is no unique or
-- exclusion constraint matching the ON CONFLICT specification". The index was
-- partial — `where external_ad_id is not null` — and Postgres will only match
-- a partial index if the statement repeats the same predicate. PostgREST's
-- `on_conflict` parameter cannot express one, so the conflict target never
-- resolved and no ad could ever be written.
--
-- It went unnoticed because the only provider wired up until now was the Meta
-- Ad Library, which returns nothing for ordinary commercial advertisers — the
-- write path was never reached. It surfaced the moment Hermes submitted real
-- ads it had found itself.
--
-- The predicate was there to let rows without an external id coexist. It is
-- unnecessary: a plain unique index already permits them, because Postgres
-- treats NULLs as distinct from each other, so any number of rows may have a
-- null external_ad_id. Dropping the predicate therefore preserves the
-- behaviour it was protecting while making the index a valid conflict target.
--
-- Safe to re-run: "if exists" / "if not exists" throughout.

drop index if exists public.competitor_ads_provider_external_id_key;

create unique index if not exists competitor_ads_provider_external_id_key
  on public.competitor_ads (source_provider, external_ad_id);
