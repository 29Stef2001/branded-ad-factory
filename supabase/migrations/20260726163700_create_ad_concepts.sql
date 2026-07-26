-- Phase 3: brand profile + AI-generated ad concepts.
-- Safe to re-run: uses "if not exists" / "drop ... if exists" throughout, no destructive drops.

create table if not exists public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  brand_name text not null,
  industry text not null,
  tone text not null,
  target_audience text not null,
  unique_selling_points text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_concepts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brief text not null,
  inspired_by_ad_id uuid references public.competitor_ads (id) on delete set null,
  headline text not null,
  hook text not null,
  body_copy text not null,
  visual_direction text not null,
  call_to_action text not null,
  created_at timestamptz not null default now()
);

alter table public.brand_profiles enable row level security;
alter table public.ad_concepts enable row level security;

-- brand_profiles: directly owned by user_id
drop policy if exists "Users can view their own brand profile" on public.brand_profiles;
create policy "Users can view their own brand profile"
  on public.brand_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own brand profile" on public.brand_profiles;
create policy "Users can insert their own brand profile"
  on public.brand_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own brand profile" on public.brand_profiles;
create policy "Users can update their own brand profile"
  on public.brand_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ad_concepts: directly owned by user_id
drop policy if exists "Users can view their own ad concepts" on public.ad_concepts;
create policy "Users can view their own ad concepts"
  on public.ad_concepts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own ad concepts" on public.ad_concepts;
create policy "Users can insert their own ad concepts"
  on public.ad_concepts for insert
  with check (auth.uid() = user_id);

-- Keep updated_at current on every brand_profiles update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_brand_profiles_updated_at on public.brand_profiles;
create trigger set_brand_profiles_updated_at
  before update on public.brand_profiles
  for each row execute function public.set_updated_at();
