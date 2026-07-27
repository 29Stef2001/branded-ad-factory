-- Brand Assets system, phase 1: approved promotional messages. Every generated
-- creative must use exactly one of these — Claude is never allowed to invent
-- promotional copy outside this list (enforced app-side too, see domain/schemas.ts).
-- Safe to re-run: "create table if not exists" / "drop ... if exists" throughout.

create table if not exists public.approved_promotional_messages (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid not null references public.brand_profiles (id) on delete cascade,
  message text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  category text,
  usage_notes text,
  region text,
  campaign text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.approved_promotional_messages enable row level security;

drop policy if exists "Users can view their own approved messages" on public.approved_promotional_messages;
create policy "Users can view their own approved messages"
  on public.approved_promotional_messages for select
  using (
    exists (
      select 1 from public.brand_profiles bp
      where bp.id = approved_promotional_messages.brand_profile_id
        and bp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert their own approved messages" on public.approved_promotional_messages;
create policy "Users can insert their own approved messages"
  on public.approved_promotional_messages for insert
  with check (
    exists (
      select 1 from public.brand_profiles bp
      where bp.id = approved_promotional_messages.brand_profile_id
        and bp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their own approved messages" on public.approved_promotional_messages;
create policy "Users can update their own approved messages"
  on public.approved_promotional_messages for update
  using (
    exists (
      select 1 from public.brand_profiles bp
      where bp.id = approved_promotional_messages.brand_profile_id
        and bp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.brand_profiles bp
      where bp.id = approved_promotional_messages.brand_profile_id
        and bp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their own approved messages" on public.approved_promotional_messages;
create policy "Users can delete their own approved messages"
  on public.approved_promotional_messages for delete
  using (
    exists (
      select 1 from public.brand_profiles bp
      where bp.id = approved_promotional_messages.brand_profile_id
        and bp.user_id = auth.uid()
    )
  );

drop trigger if exists set_approved_promotional_messages_updated_at on public.approved_promotional_messages;
create trigger set_approved_promotional_messages_updated_at
  before update on public.approved_promotional_messages
  for each row execute function public.set_updated_at();

-- Seed the 10 default approved messages for every new brand profile, the same
-- way auth.users -> public.profiles is seeded by trigger elsewhere in this app.
create or replace function public.seed_default_promotional_messages()
returns trigger
language plpgsql
as $$
begin
  insert into public.approved_promotional_messages (brand_profile_id, message, sort_order)
  values
    (new.id, 'EVERYTHING FOR FREE', 0),
    (new.id, 'STORE IS CLOSING', 1),
    (new.id, '$0 ONLY COVER SHIPPING', 2),
    (new.id, 'FREE TODAY', 3),
    (new.id, 'FINAL DAYS', 4),
    (new.id, 'WAREHOUSE CLEARANCE', 5),
    (new.id, 'FINAL STOCK', 6),
    (new.id, 'CLOSING SALE', 7),
    (new.id, 'RETIREMENT SALE', 8),
    (new.id, 'LAST CHANCE', 9);
  return new;
end;
$$;

drop trigger if exists seed_default_promotional_messages_trigger on public.brand_profiles;
create trigger seed_default_promotional_messages_trigger
  after insert on public.brand_profiles
  for each row execute function public.seed_default_promotional_messages();

-- Backfill: brand profiles created before this migration have no messages yet.
insert into public.approved_promotional_messages (brand_profile_id, message, sort_order)
select bp.id, defaults.message, defaults.sort_order
from public.brand_profiles bp
cross join (
  values
    ('EVERYTHING FOR FREE', 0),
    ('STORE IS CLOSING', 1),
    ('$0 ONLY COVER SHIPPING', 2),
    ('FREE TODAY', 3),
    ('FINAL DAYS', 4),
    ('WAREHOUSE CLEARANCE', 5),
    ('FINAL STOCK', 6),
    ('CLOSING SALE', 7),
    ('RETIREMENT SALE', 8),
    ('LAST CHANCE', 9)
) as defaults (message, sort_order)
where not exists (
  select 1 from public.approved_promotional_messages existing
  where existing.brand_profile_id = bp.id
);
