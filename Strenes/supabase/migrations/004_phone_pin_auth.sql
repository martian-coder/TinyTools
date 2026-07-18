-- Migration 004: phone + PIN authentication (replaces email OTP).
--
-- Registration: phone + a 4-6 digit PIN. The PIN is bcrypt-hashed server
-- side (pgcrypto); plaintext never touches a table. Signing in again with
-- the same phone + PIN reclaims the account (message history moves via
-- claim_phone_account from SUPABASE_SETUP.md §2.5 — required). Wrong PIN
-- 5 times → 15-minute lockout.
--
-- Run once in Supabase → SQL Editor.

create extension if not exists pgcrypto;

create table if not exists phone_credentials (
  phone text primary key,
  user_id uuid not null,
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

alter table phone_credentials enable row level security;
-- No policies on purpose: the SECURITY DEFINER functions below are the
-- only access path, so pin hashes are never readable by clients.

-- Does this number already have a PIN? (Lets the app show "enter your PIN"
-- vs "create a PIN". Reveals that a number is registered — acceptable here,
-- since contact search reveals the same.)
create or replace function phone_has_pin(p_phone text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from phone_credentials where phone = p_phone);
$$;

-- Register (first PIN for a number) or sign in (matching PIN). Returns
-- 'registered' or 'signed_in'; raises on wrong PIN / lockout.
create or replace function claim_phone_with_pin(p_phone text, p_pin text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cred phone_credentials%rowtype;
  uid uuid := auth.uid();
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
    -- Adopt any legacy account that used this number before PINs existed.
    perform claim_phone_account(p_phone);
    return 'registered';
  end if;

  if cred.locked_until is not null and cred.locked_until > now() then
    raise exception 'Too many wrong attempts — try again in 15 minutes';
  end if;

  if cred.pin_hash = crypt(p_pin, cred.pin_hash) then
    update phone_credentials
       set failed_attempts = 0, locked_until = null, user_id = uid
     where phone = p_phone;
    -- Move the account (users row, messages, contact links) to this session.
    perform claim_phone_account(p_phone);
    return 'signed_in';
  end if;

  update phone_credentials
     set failed_attempts = failed_attempts + 1,
         locked_until = case when failed_attempts + 1 >= 5
                             then now() + interval '15 minutes' end
   where phone = p_phone;
  raise exception 'Wrong PIN';
end;
$$;

revoke all on function phone_has_pin(text) from public;
revoke all on function claim_phone_with_pin(text, text) from public;
grant execute on function phone_has_pin(text) to authenticated, anon;
grant execute on function claim_phone_with_pin(text, text) to authenticated;
