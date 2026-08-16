-- Multiple ad accounts and Facebook Pages per user.
--
-- The OAuth token already covers every account the person can see — 44 in the
-- first real case — so the credential stays one row per user. What was missing
-- is a catalogue of what that token can reach and a record of which of those
-- the user actually wants synced and launched to.
--
-- Safe to re-run: "if not exists" / "drop policy if exists" throughout.

-- ---------------------------------------------------------------------------
-- meta_ad_accounts — every account the token can see, and which are in use
-- ---------------------------------------------------------------------------
create table if not exists public.meta_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  ad_account_id text not null,
  name text,
  currency text,
  account_status int,
  business_name text,

  -- Selection is the whole point of this table. Syncing all 44 accounts would
  -- burn API quota on brands this workspace has nothing to do with, and mixing
  -- them into one score table would make every ranking meaningless.
  is_selected boolean not null default false,
  -- Where a launch goes when nothing more specific is chosen.
  is_default boolean not null default false,

  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, ad_account_id)
);

create index if not exists meta_ad_accounts_selected_idx
  on public.meta_ad_accounts (user_id, is_selected)
  where is_selected = true;

-- At most one default per user. A second default is not a preference, it is a
-- bug that would silently pick whichever row sorted first.
create unique index if not exists meta_ad_accounts_one_default_idx
  on public.meta_ad_accounts (user_id)
  where is_default = true;

alter table public.meta_ad_accounts enable row level security;

drop policy if exists "Users manage their own ad accounts" on public.meta_ad_accounts;
create policy "Users manage their own ad accounts"
  on public.meta_ad_accounts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- meta_pages — Facebook Pages, required by every ad creative
-- ---------------------------------------------------------------------------
-- An ad creative must name a Page. Without one there is no ad, whatever
-- permissions the token holds — which is why this is stored rather than picked
-- at launch time from a live call that might return nothing.

create table if not exists public.meta_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  page_id text not null,
  name text,
  -- Page-scoped token, distinct from the user token. Nullable because the
  -- catalogue can be populated before pages_manage_ads is granted.
  page_access_token text,
  instagram_actor_id text,

  is_default boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, page_id)
);

create unique index if not exists meta_pages_one_default_idx
  on public.meta_pages (user_id)
  where is_default = true;

alter table public.meta_pages enable row level security;

drop policy if exists "Users manage their own pages" on public.meta_pages;
create policy "Users manage their own pages"
  on public.meta_pages for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Which account did this row come from?
-- ---------------------------------------------------------------------------
-- With one account it was implicit. With several it is the difference between
-- a ranking of one brand's creatives and a ranking of everything mixed
-- together. Nullable so existing rows survive; the sync fills it going forward.

alter table public.meta_ad_entities
  add column if not exists ad_account_id text;

create index if not exists meta_ad_entities_account_idx
  on public.meta_ad_entities (user_id, ad_account_id);

alter table public.ad_insights_daily
  add column if not exists ad_account_id text;

alter table public.creative_metrics
  add column if not exists ad_account_id text;

create index if not exists creative_metrics_account_idx
  on public.creative_metrics (user_id, ad_account_id, window_days);

-- ---------------------------------------------------------------------------
-- Seed the catalogue from the existing connection
-- ---------------------------------------------------------------------------
-- So the account already connected does not disappear from the UI the moment
-- selection becomes a thing. It is marked selected and default because it is
-- what the workspace has been syncing until now.

insert into public.meta_ad_accounts (user_id, ad_account_id, is_selected, is_default)
select c.user_id, c.ad_account_id, true, true
from public.meta_ad_account_connections c
on conflict (user_id, ad_account_id) do nothing;

-- Backfill the account onto rows that predate the column, which all came from
-- that same single connection.
update public.meta_ad_entities e
set ad_account_id = c.ad_account_id
from public.meta_ad_account_connections c
where e.user_id = c.user_id and e.ad_account_id is null;

update public.ad_insights_daily i
set ad_account_id = c.ad_account_id
from public.meta_ad_account_connections c
where i.user_id = c.user_id and i.ad_account_id is null;

update public.creative_metrics m
set ad_account_id = c.ad_account_id
from public.meta_ad_account_connections c
where m.user_id = c.user_id and m.ad_account_id is null;
