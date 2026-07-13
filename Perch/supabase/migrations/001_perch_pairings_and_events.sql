-- Perch migration 001: pairings + flag events.
--
-- Runs in the SAME Supabase project as Strenes; everything is namespaced
-- perch_*. Run this once in the SQL editor (Dashboard → SQL → New query).
--
-- Security model (capability-based, no user accounts needed):
--   * perch_pairings.id is an unguessable UUID — knowing it IS the
--     permission to read that pairing's events (like a private link).
--   * The human-friendly 6-char code is one-shot: consumed by
--     perch_claim_pairing(), useless afterwards.
--   * Anon clients get NO direct select on either table. All reads go
--     through SECURITY DEFINER RPCs that require the pairing UUID.
--   * Anon INSERT into perch_events is allowed only for claimed pairings
--     (the kid's watcher posts flags with the anon key + pairing UUID).
--   * Events carry METADATA ONLY — there is no message-content column,
--     by design. Don't add one.

-- ── Tables ───────────────────────────────────────────────────────────────────

create table if not exists perch_pairings (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  kid_alias text not null default 'my kid',
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists perch_events (
  id text primary key,
  pairing_id uuid not null references perch_pairings(id) on delete cascade,
  category text not null,
  severity text not null check (severity in ('alert', 'watch')),
  reason text not null,
  app text not null default '',
  sender text not null default '',
  at_ms bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists perch_events_pairing_at on perch_events (pairing_id, at_ms desc);

-- ── RLS: lock both tables down; RPCs are the only door ──────────────────────

alter table perch_pairings enable row level security;
alter table perch_events enable row level security;

-- The kid's watcher inserts flags directly (REST) with the anon key.
-- Valid only for a claimed pairing whose UUID the caller knows.
drop policy if exists "perch events insert for claimed pairing" on perch_events;
create policy "perch events insert for claimed pairing" on perch_events
  for insert to anon, authenticated
  with check (
    exists (select 1 from perch_pairings p where p.id = pairing_id and p.claimed)
  );

-- No select/update/delete policies on purpose: reads via RPCs below.

-- ── RPCs ─────────────────────────────────────────────────────────────────────

-- Parent: create a pairing, get back {pairing_id, code}.
create or replace function perch_create_pairing(p_kid_alias text)
returns table (pairing_id uuid, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  -- 6 chars, unambiguous alphabet (no 0/O/1/I).
  v_code := (
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (random() * 31 + 1)::int, 1), '')
    from generate_series(1, 6)
  );
  return query
    insert into perch_pairings (code, kid_alias)
    values (v_code, coalesce(nullif(trim(p_kid_alias), ''), 'my kid'))
    returning perch_pairings.id, perch_pairings.code;
end;
$$;

-- Kid: claim a code (one-shot). Returns the pairing UUID or null.
create or replace function perch_claim_pairing(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update perch_pairings
     set claimed = true
   where code = upper(trim(p_code))
     and not claimed
     and created_at > now() - interval '48 hours'
  returning id into v_id;
  return v_id;
end;
$$;

-- Parent: has the kid's phone claimed the code yet?
create or replace function perch_pairing_claimed(p_pairing_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select claimed from perch_pairings where id = p_pairing_id),
    false
  );
$$;

-- Parent: fetch events newer than p_since_ms (0 = everything).
create or replace function perch_fetch_events(p_pairing_id uuid, p_since_ms bigint)
returns table (id text, category text, severity text, reason text, app text, sender text, at_ms bigint)
language sql
security definer
set search_path = public
stable
as $$
  select e.id, e.category, e.severity, e.reason, e.app, e.sender, e.at_ms
  from perch_events e
  where e.pairing_id = p_pairing_id
    and e.at_ms > p_since_ms
  order by e.at_ms desc
  limit 500;
$$;

grant execute on function perch_create_pairing(text) to anon, authenticated;
grant execute on function perch_claim_pairing(text) to anon, authenticated;
grant execute on function perch_pairing_claimed(uuid) to anon, authenticated;
grant execute on function perch_fetch_events(uuid, bigint) to anon, authenticated;
