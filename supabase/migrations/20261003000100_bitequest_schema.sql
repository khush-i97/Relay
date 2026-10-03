create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  user_id uuid primary key,
  total_xp integer not null default 0 check (total_xp >= 0),
  created_at timestamptz not null default now()
);

create table public.restaurants (
  id text primary key,
  name text not null,
  cuisine text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  discovery_xp integer not null check (discovery_xp in (150, 400, 800, 1200)),
  reward_cents integer not null default 50 check (reward_cents = 50),
  estimated_meal_cents integer not null check (estimated_meal_cents > 0),
  tags text[] not null default '{}',
  description text not null,
  image_url text,
  availability text check (availability is null or availability in ('open', 'closed')),
  is_synthetic boolean not null default true
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  restaurant_id text not null references public.restaurants(id),
  receipt_id text not null,
  bill_cents integer not null check (bill_cents >= 500),
  local_date date not null,
  xp_awarded integer not null check (xp_awarded >= 0),
  credit_awarded_cents integer not null check (credit_awarded_cents = 50),
  created_at timestamptz not null default now(),
  unique (user_id, receipt_id),
  unique (user_id, restaurant_id, local_date)
);

create table public.discoveries (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  restaurant_id text not null references public.restaurants(id),
  first_visit_id uuid not null unique references public.visits(id) on delete cascade,
  discovered_at timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  restaurant_id text not null references public.restaurants(id),
  demo_receipt_id text not null,
  bill_cents integer not null check (bill_cents > 0),
  amount_cents integer not null check (amount_cents between 1 and 500 and amount_cents <= bill_cents),
  settlement_status text not null default 'simulated' check (settlement_status = 'simulated'),
  created_at timestamptz not null default now(),
  unique (user_id, demo_receipt_id)
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  restaurant_id text not null references public.restaurants(id),
  kind text not null check (kind in ('earn', 'redeem')),
  delta_cents integer not null check ((kind = 'earn' and delta_cents > 0) or (kind = 'redeem' and delta_cents < 0)),
  reference_id uuid not null unique,
  created_at timestamptz not null default now()
);

create table public.idempotency_records (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  operation text not null check (operation in ('visit', 'redemption')),
  key text not null,
  request_hash text not null,
  response_status integer not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation, key)
);

create table public.demo_sessions (
  token_hash text primary key,
  session_id uuid not null unique,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  category text not null check (category in ('planning', 'mutation')),
  created_at timestamptz not null default now()
);

create index visits_user_date_idx on public.visits (user_id, local_date);
create index wallet_transactions_user_created_idx on public.wallet_transactions (user_id, created_at desc);
create index discoveries_user_idx on public.discoveries (user_id);
create index rate_limit_events_window_idx on public.rate_limit_events (user_id, category, created_at desc);
create index demo_sessions_user_idx on public.demo_sessions (user_id);

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.visits enable row level security;
alter table public.discoveries enable row level security;
alter table public.redemptions enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.idempotency_records enable row level security;
alter table public.demo_sessions enable row level security;
alter table public.rate_limit_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
