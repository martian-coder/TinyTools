-- Migration 005: make registered users discoverable, unconditionally.
--
-- Two people registered on two phones and couldn't find each other. Two
-- root causes, both fixed here server-side so discoverability no longer
-- depends on the client finishing the name step or on the users-table
-- SELECT policy being present:
--
--   1) claim_phone_with_pin() now UPSERTS the users row itself (it runs
--      SECURITY DEFINER, so it bypasses insert RLS). The moment PIN
--      registration succeeds, the account is searchable — even if the app
--      never reaches the "display name" screen.
--
--   2) find_user_by_phone() is a SECURITY DEFINER search RPC: exact E.164
--      match, then a trailing-10-digit fuzzy match (handles a missing/
--      different country code, e.g. "91…" vs "+91 …"). Because it is
--      DEFINER it works even if the "read all profiles" SELECT policy was
--      never applied.
--
-- Run once in Supabase → SQL Editor. Safe to re-run.

-- ── 1. PIN claim also materializes the users row ────────────────────────────

create or replace function claim_phone_with_pin(p_phone text, p_pin text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cred phone_credentials%rowtype;
  uid uuid := auth.uid();
  result text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'PIN must be 4-8 digits';
  end if;

  select * into cred from phone_credentials where phone = p_phone;

  if not found then
    insert into phone_credentials (phone, user_id, pin_hash)
      values (p_phone, uid, crypt(p_pin, gen_salt('bf')));
    perform claim_phone_account(p_phone);
    result := 'registered';
  elsif cred.locked_until is not null and cred.locked_until > now() then
    raise exception 'Too many wrong attempts — try again in 15 minutes';
  elsif cred.pin_hash = crypt(p_pin, cred.pin_hash) then
    update phone_credentials
       set failed_attempts = 0, locked_until = null, user_id = uid
     where phone = p_phone;
    perform claim_phone_account(p_phone);
    result := 'signed_in';
  else
    update phone_credentials
       set failed_attempts = failed_attempts + 1,
           locked_until = case when failed_attempts + 1 >= 5
                               then now() + interval '15 minutes' end
     where phone = p_phone;
    raise exception 'Wrong PIN';
  end if;

  -- Guarantee a discoverable users row for this session's account.
  -- Keeps an existing display_name; defaults it to the phone otherwise.
  insert into users (id, phone, display_name, created_at, last_seen, online)
    values (uid, p_phone, p_phone,
            (extract(epoch from now()) * 1000)::bigint,
            (extract(epoch from now()) * 1000)::bigint, true)
  on conflict (id) do update
    set phone = excluded.phone,
        last_seen = excluded.last_seen,
        online = true;

  return result;
end;
$$;

revoke all on function claim_phone_with_pin(text, text) from public;
grant execute on function claim_phone_with_pin(text, text) to authenticated;

-- ── 2. RLS-independent search ───────────────────────────────────────────────

create or replace function find_user_by_phone(p_phone text)
returns table (id uuid, phone text, display_name text, last_seen bigint, online boolean)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  tail text := right(regexp_replace(p_phone, '\D', '', 'g'), 10);
begin
  -- Exact match first.
  return query
    select u.id, u.phone, u.display_name, u.last_seen, u.online
    from users u where u.phone = p_phone limit 1;
  if found then return; end if;

  -- Trailing-10-digit fuzzy match (missing/other country code).
  if length(tail) = 10 then
    return query
      select u.id, u.phone, u.display_name, u.last_seen, u.online
      from users u where u.phone like '%' || tail limit 1;
  end if;
end;
$$;

revoke all on function find_user_by_phone(text) from public;
grant execute on function find_user_by_phone(text) to authenticated, anon;
