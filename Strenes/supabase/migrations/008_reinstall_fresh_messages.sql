-- Migration 008: reinstalling starts with a fresh inbox, but keeps contacts.
--
-- TEMPORARY testing convenience (per Amit, while iterating on builds) —
-- NOT the intended behavior for real users at launch. When ready to launch,
-- restore migration 006's original claim_phone_account (the version that
-- also migrates `messages`) so reinstalls keep full message history like
-- a normal messaging app.
--
-- Run this ONCE, then re-run the one-time flush below whenever you want to
-- clear out the message clutter that's already accumulated from testing.

create or replace function claim_phone_account(p_phone text)
returns void
language plpgsql
security definer
set search_path = public, extensions
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

  -- Message history is intentionally NOT migrated — old_id's messages are
  -- simply left behind (orphaned, never surfaced again) so every reinstall
  -- starts with an empty inbox. Contacts still move over, so people already
  -- searched-and-added don't need to be re-added each time.
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

-- ── One-time flush of message clutter already accumulated from testing ──
-- Contacts, users and PINs are untouched — only chat history is cleared.
delete from messages;
