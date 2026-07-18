-- Migration 006: consolidated phone + PIN auth (run this ONE script).
--
-- Supersedes running 004 and 005 separately. Creates everything in
-- dependency order so it works on a database that only has the base
-- tables (users / messages / contacts). Safe to re-run.

-- ── 0. Extension ────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ── 1. Account-move helper (needed by claim_phone_with_pin) ─────────────────
-- Moves message history + contact links from a previous account on the same
-- phone to the current session, then frees the number.
create or replace function claim_phone_account(p_phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_id uuid;
  new_id uuid := auth.uid();
begin
  if new_id is null then
    raise exception 'not authenticated';
  end if;
  select id into old_id from users where phone = p_phone;
  if old_id is null or old_id = new_id then
    return; -- number is free, or already ours
  end if;

  update messages set from_user_id = new_id where from_user_id = old_id;
  update messages set to_user_id   = new_id where to_user_id   = old_id;

  delete from contacts c where c.user_id = old_id
    and exists (select 1 from contacts d
                where d.user_id = new_id and d.contact_user_id = c.contact_user_id);
  update contacts set user_id = new_id where user_id = old_id;
  delete from contacts c where c.contact_user_id = old_id
    and exists (select 1 from contacts d
                where d.contact_user_id = new_id and d.user_id = c.user_id);
  update contacts set contact_user_id = new_id where contact_user_id = old_id;

  delete from users where id = old_id;
end;
$$;
revoke all on function claim_phone_account(text) from public;
grant execute on function claim_phone_account(text) to authenticated;

-- ── 2. Credentials table ────────────────────────────────────────────────────
create table if not exists phone_credentials (
  phone text primary key,
  user_id uuid not null,
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);
alter table phone_credentials enable row level security;
-- No policies: the SECURITY DEFINER functions below are the only access path.

-- ── 3. "Does this number have a PIN?" (enter vs create UX) ───────────────────
create or replace function phone_has_pin(p_phone text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from phone_credentials where phone = p_phone);
$$;
revoke all on function phone_has_pin(text) from public;
grant execute on function phone_has_pin(text) to authenticated, anon;

-- ── 4. Register / sign in with PIN (also materializes the users row) ────────
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
  if uid is null then raise exception 'not authenticated'; end if;
  if p_pin !~ '^[0-9]{4,8}$' then raise exception 'PIN must be 4-8 digits'; end if;

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

  -- Guarantee a discoverable users row (keeps an existing display_name).
  insert into users (id, phone, display_name, created_at, last_seen, online)
    values (uid, p_phone, p_phone,
            (extract(epoch from now()) * 1000)::bigint,
            (extract(epoch from now()) * 1000)::bigint, true)
  on conflict (id) do update
    set phone = excluded.phone, last_seen = excluded.last_seen, online = true;

  return result;
end;
$$;
revoke all on function claim_phone_with_pin(text, text) from public;
grant execute on function claim_phone_with_pin(text, text) to authenticated;

-- ── 5. RLS-independent contact search ───────────────────────────────────────
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
  return query
    select u.id, u.phone, u.display_name, u.last_seen, u.online
    from users u where u.phone = p_phone limit 1;
  if found then return; end if;
  if length(tail) = 10 then
    return query
      select u.id, u.phone, u.display_name, u.last_seen, u.online
      from users u where u.phone like '%' || tail limit 1;
  end if;
end;
$$;
revoke all on function find_user_by_phone(text) from public;
grant execute on function find_user_by_phone(text) to authenticated, anon;
