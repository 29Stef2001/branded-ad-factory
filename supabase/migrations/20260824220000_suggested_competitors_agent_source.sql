-- Adds 'agent_discovery' as a valid suggested_competitors.source — the
-- Hermes MCP gateway's competitor_discover() tool writes candidates with
-- this source, distinct from the existing manual-flag ('manual_search') and
-- angle-overlap sources.
--
-- Safe to re-run: drop/recreate is the same idiom every other constraint
-- update in this codebase uses.

alter table public.suggested_competitors
  drop constraint if exists suggested_competitors_source_check;

alter table public.suggested_competitors
  add constraint suggested_competitors_source_check
  check (source in ('manual_search', 'angle_overlap', 'agent_discovery'));
