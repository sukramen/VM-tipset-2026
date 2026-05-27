create table if not exists public.vm_profiles (
  id text primary key,
  name text not null,
  initials text not null,
  role text not null check (role in ('admin', 'player')),
  password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vm_predictions (
  profile_id text not null references public.vm_profiles(id) on delete cascade,
  match_id int not null,
  home_score int,
  away_score int,
  winner text,
  updated_at timestamptz not null default now(),
  primary key (profile_id, match_id)
);

create table if not exists public.vm_bonus_predictions (
  profile_id text primary key references public.vm_profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.vm_match_results (
  match_id int primary key,
  home_score int not null,
  away_score int not null,
  winner text,
  updated_at timestamptz not null default now()
);

create table if not exists public.vm_app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.vm_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vm_profiles_updated_at on public.vm_profiles;
create trigger vm_profiles_updated_at
before update on public.vm_profiles
for each row execute function public.vm_set_updated_at();

drop trigger if exists vm_predictions_updated_at on public.vm_predictions;
create trigger vm_predictions_updated_at
before update on public.vm_predictions
for each row execute function public.vm_set_updated_at();

drop trigger if exists vm_bonus_predictions_updated_at on public.vm_bonus_predictions;
create trigger vm_bonus_predictions_updated_at
before update on public.vm_bonus_predictions
for each row execute function public.vm_set_updated_at();

drop trigger if exists vm_match_results_updated_at on public.vm_match_results;
create trigger vm_match_results_updated_at
before update on public.vm_match_results
for each row execute function public.vm_set_updated_at();

drop trigger if exists vm_app_state_updated_at on public.vm_app_state;
create trigger vm_app_state_updated_at
before update on public.vm_app_state
for each row execute function public.vm_set_updated_at();

alter table public.vm_profiles enable row level security;
alter table public.vm_predictions enable row level security;
alter table public.vm_bonus_predictions enable row level security;
alter table public.vm_match_results enable row level security;
alter table public.vm_app_state enable row level security;

drop policy if exists "Public read vm_profiles" on public.vm_profiles;
create policy "Public read vm_profiles" on public.vm_profiles for select using (true);
drop policy if exists "Public write vm_profiles" on public.vm_profiles;
create policy "Public write vm_profiles" on public.vm_profiles for all using (true) with check (true);

drop policy if exists "Public read vm_predictions" on public.vm_predictions;
create policy "Public read vm_predictions" on public.vm_predictions for select using (true);
drop policy if exists "Public write vm_predictions" on public.vm_predictions;
create policy "Public write vm_predictions" on public.vm_predictions for all using (true) with check (true);

drop policy if exists "Public read vm_bonus_predictions" on public.vm_bonus_predictions;
create policy "Public read vm_bonus_predictions" on public.vm_bonus_predictions for select using (true);
drop policy if exists "Public write vm_bonus_predictions" on public.vm_bonus_predictions;
create policy "Public write vm_bonus_predictions" on public.vm_bonus_predictions for all using (true) with check (true);

drop policy if exists "Public read vm_match_results" on public.vm_match_results;
create policy "Public read vm_match_results" on public.vm_match_results for select using (true);
drop policy if exists "Public write vm_match_results" on public.vm_match_results;
create policy "Public write vm_match_results" on public.vm_match_results for all using (true) with check (true);

drop policy if exists "Public read vm_app_state" on public.vm_app_state;
create policy "Public read vm_app_state" on public.vm_app_state for select using (true);
drop policy if exists "Public write vm_app_state" on public.vm_app_state;
create policy "Public write vm_app_state" on public.vm_app_state for all using (true) with check (true);
