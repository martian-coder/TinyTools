-- Migration 007: contact search matches numbers in ANY stored format.
--
-- Some accounts (older builds) stored phone numbers without "+" or with
-- other formatting, so searching them failed one-way. Compare the last 10
-- digits of BOTH sides, digits-only, so any typed format finds any stored
-- format. Safe to re-run.

create or replace function find_user_by_phone(p_phone text)
returns table (id uuid, phone text, display_name text, last_seen bigint, online boolean)
language plpgsql
security definer
set search_path = public, extensions
stable
as $$
declare
  tail text := right(regexp_replace(p_phone, '\D', '', 'g'), 10);
begin
  -- Exact match first (fast path).
  return query
    select u.id, u.phone, u.display_name, u.last_seen, u.online
    from users u where u.phone = p_phone limit 1;
  if found then return; end if;

  -- Digits-only tail match, normalized on BOTH sides.
  if length(tail) >= 7 then
    return query
      select u.id, u.phone, u.display_name, u.last_seen, u.online
      from users u
      where right(regexp_replace(u.phone, '\D', '', 'g'), length(tail)) = tail
      order by u.last_seen desc nulls last
      limit 1;
  end if;
end;
$$;
revoke all on function find_user_by_phone(text) from public;
grant execute on function find_user_by_phone(text) to authenticated, anon;
