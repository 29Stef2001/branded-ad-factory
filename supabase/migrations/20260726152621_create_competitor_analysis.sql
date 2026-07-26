-- Phase 2: competitor ad tracking + AI analysis.
-- Safe to re-run: uses "if not exists" / "drop ... if exists" throughout, no destructive drops.

create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  meta_page_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.competitor_ads (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references public.competitors (id) on delete cascade,
  meta_ad_archive_id text not null unique,
  page_name text,
  ad_creative_body text,
  ad_creative_link_title text,
  ad_creative_link_description text,
  ad_snapshot_url text,
  ad_delivery_start_time timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ad_analyses (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null unique references public.competitor_ads (id) on delete cascade,
  messaging_angle text not null,
  hook text not null,
  tone text not null,
  target_audience text not null,
  call_to_action text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

alter table public.competitors enable row level security;
alter table public.competitor_ads enable row level security;
alter table public.ad_analyses enable row level security;

-- competitors: directly owned by user_id
drop policy if exists "Users can view their own competitors" on public.competitors;
create policy "Users can view their own competitors"
  on public.competitors for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own competitors" on public.competitors;
create policy "Users can insert their own competitors"
  on public.competitors for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own competitors" on public.competitors;
create policy "Users can update their own competitors"
  on public.competitors for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- competitor_ads: owned indirectly via competitors.user_id
drop policy if exists "Users can view ads for their own competitors" on public.competitor_ads;
create policy "Users can view ads for their own competitors"
  on public.competitor_ads for select
  using (
    exists (
      select 1 from public.competitors c
      where c.id = competitor_ads.competitor_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert ads for their own competitors" on public.competitor_ads;
create policy "Users can insert ads for their own competitors"
  on public.competitor_ads for insert
  with check (
    exists (
      select 1 from public.competitors c
      where c.id = competitor_ads.competitor_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update ads for their own competitors" on public.competitor_ads;
create policy "Users can update ads for their own competitors"
  on public.competitor_ads for update
  using (
    exists (
      select 1 from public.competitors c
      where c.id = competitor_ads.competitor_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.competitors c
      where c.id = competitor_ads.competitor_id
        and c.user_id = auth.uid()
    )
  );

-- ad_analyses: owned indirectly via competitor_ads -> competitors.user_id
drop policy if exists "Users can view analyses for their own ads" on public.ad_analyses;
create policy "Users can view analyses for their own ads"
  on public.ad_analyses for select
  using (
    exists (
      select 1 from public.competitor_ads ca
      join public.competitors c on c.id = ca.competitor_id
      where ca.id = ad_analyses.ad_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert analyses for their own ads" on public.ad_analyses;
create policy "Users can insert analyses for their own ads"
  on public.ad_analyses for insert
  with check (
    exists (
      select 1 from public.competitor_ads ca
      join public.competitors c on c.id = ca.competitor_id
      where ca.id = ad_analyses.ad_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update analyses for their own ads" on public.ad_analyses;
create policy "Users can update analyses for their own ads"
  on public.ad_analyses for update
  using (
    exists (
      select 1 from public.competitor_ads ca
      join public.competitors c on c.id = ca.competitor_id
      where ca.id = ad_analyses.ad_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.competitor_ads ca
      join public.competitors c on c.id = ca.competitor_id
      where ca.id = ad_analyses.ad_id
        and c.user_id = auth.uid()
    )
  );
