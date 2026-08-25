-- A competitor no longer needs a Meta Page ID to be tracked.
--
-- `meta_page_id not null` dates from when the Meta Ad Library API was the
-- only way ads arrived: without a Page ID there was nothing to query, so
-- requiring one was honest. That stopped being true twice over. The Ad
-- Library API turned out not to cover ordinary commercial advertisers at
-- all, and `competitor_ads_submit` now accepts ads Hermes observed itself,
-- where a website is the identifying detail and the numeric Page ID is
-- irrelevant.
--
-- The constraint had become a dead end rather than a guarantee: automated
-- discovery produces a name and a website (a model cannot reliably know a
-- numeric Page ID), so every discovered candidate was un-approvable — the
-- approve action refused it, and the column would have refused it too. The
-- column is relaxed rather than dropped: it is still the right identifier
-- when a Page ID *is* known, and existing rows keep theirs.
--
-- Safe to re-run: dropping a NOT NULL that is already dropped is a no-op in
-- Postgres.

alter table public.competitors
  alter column meta_page_id drop not null;
