-- Migration 003: fix infinite-recursion in group RLS policies.
--
-- The 002 policies on group_members referenced group_members inside their own
-- USING clause, which Postgres rejects at query time with
-- "infinite recursion detected in policy for relation group_members" (42P17).
-- Fix: a SECURITY DEFINER helper owned by the table owner (bypasses RLS) does
-- the membership lookup; every policy calls the helper instead of the table.

-- ── Helper functions (bypass RLS internally) ─────────────────────────────────

create or replace function is_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function is_group_admin(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid() and role = 'admin'
  );
$$;

-- ── Replace policies ─────────────────────────────────────────────────────────

-- groups
drop policy if exists "group visible to members" on groups;
create policy "group visible to members"
  on groups for select
  using (is_group_member(id) or created_by = auth.uid());

-- group_members
drop policy if exists "group members visible to group" on group_members;
create policy "group members visible to group"
  on group_members for select
  using (is_group_member(group_id) or user_id = auth.uid());

drop policy if exists "admins and creator can add members" on group_members;
create policy "admins and creator can add members"
  on group_members for insert
  with check (
    is_group_admin(group_id)
    or exists (select 1 from groups g where g.id = group_id and g.created_by = auth.uid())
  );

-- group_messages
drop policy if exists "group messages readable by members" on group_messages;
create policy "group messages readable by members"
  on group_messages for select
  using (is_group_member(group_id));

drop policy if exists "group members can insert messages" on group_messages;
create policy "group members can insert messages"
  on group_messages for insert
  with check (auth.uid() = from_user_id and is_group_member(group_id));

drop policy if exists "members can update delivered flag" on group_messages;
create policy "members can update delivered flag"
  on group_messages for update
  using (is_group_member(group_id));
