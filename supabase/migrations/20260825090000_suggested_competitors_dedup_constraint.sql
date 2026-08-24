-- Fixes a real race condition found in testing: competitor_discover() used
-- to read existing suggestion names, filter candidates against that read,
-- then insert — a classic time-of-check-to-time-of-use gap. Two overlapping
-- discovery calls (e.g. a client retry after a slow response, or two
-- concurrent Hermes tool calls) both read "not present yet" and both
-- inserted, producing duplicate suggestions for the same brand.
--
-- The fix has to live here, not in application code: no amount of
-- read-then-write logic in TypeScript can be made atomic against a second
-- process doing the same thing at the same time. Only the database can
-- enforce "at most one" across concurrent connections, via a constraint the
-- write itself is checked against.
--
-- Expression index rather than a generated column: no new column needed,
-- and it matches the exact normalization (trim + lowercase) the
-- application's own duplicate check already used before this fix — so a
-- name that used to be treated as a duplicate in memory now is a duplicate
-- in the database, not a different rule.
--
-- Safe to re-run: "if not exists" throughout. Confirmed empty before adding
-- this — see verification in the accompanying conversation, not encoded
-- here since a migration should not assume data state.

create unique index if not exists suggested_competitors_user_name_key
  on public.suggested_competitors (user_id, lower(btrim(name)));
