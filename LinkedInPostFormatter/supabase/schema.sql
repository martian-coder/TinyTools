-- LinkedIn Formatter — Supabase schema
-- Run once in the Supabase SQL editor.
--
-- Two tables and nothing more: who someone is and when their trial started, and
-- a log of what gets used. Everything else the app needs already lives in the
-- browser.

-- ── profiles ────────────────────────────────────────────────────────────────
-- One row per user, created automatically on sign-up. trial_started_at is the
-- only thing standing between a free user and a paying one, so it is set by the
-- database rather than the client — a value the browser can write is a value the
-- browser can reset.
create table if not exists public.profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  email                  text,
  trial_started_at       timestamptz not null default now(),
  plan                   text not null default 'trial'   -- trial | active | expired
    check (plan in ('trial', 'active', 'expired')),
  paypal_subscription_id text,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A user may read and update their own row, but the columns that decide whether
-- they pay are locked below by trigger — RLS alone would let them set plan='active'.
create policy "read own profile"   on public.profiles for select using (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id);

create or replace function public.protect_billing_columns()
returns trigger language plpgsql security definer as $$
begin
  -- Only the service role (webhooks, admin) may move billing state.
  if auth.role() <> 'service_role' then
    new.plan                   := old.plan;
    new.trial_started_at       := old.trial_started_at;
    new.paypal_subscription_id := old.paypal_subscription_id;
    new.current_period_end     := old.current_period_end;
  end if;
  return new;
end $$;

drop trigger if exists protect_billing on public.profiles;
create trigger protect_billing
  before update on public.profiles
  for each row execute function public.protect_billing_columns();

-- Create the profile row the moment a user signs up, so the trial clock starts
-- server-side and not on whenever the client first gets round to writing.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── usage_events ────────────────────────────────────────────────────────────
-- What people actually do. Deliberately no post text: the tool's promise is that
-- what you write stays on your device, and logging drafts would break it.
create table if not exists public.usage_events (
  id         bigserial primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  event      text not null,          -- copy | apply_style | use_template | export ...
  detail     text,                   -- style id, template id — never post content
  created_at timestamptz not null default now()
);

alter table public.usage_events enable row level security;

create policy "insert own events" on public.usage_events
  for insert with check (auth.uid() = user_id);
create policy "read own events"   on public.usage_events
  for select using (auth.uid() = user_id);

create index if not exists usage_events_user_time
  on public.usage_events (user_id, created_at desc);

-- ── what you will actually want to look at ──────────────────────────────────
-- Which features get used, by how many distinct people. This is the query that
-- tells you what is worth charging for.
create or replace view public.usage_summary as
  select event,
         count(*)                       as total,
         count(distinct user_id)        as people,
         max(created_at)                as last_seen
    from public.usage_events
   group by event
   order by people desc, total desc;
