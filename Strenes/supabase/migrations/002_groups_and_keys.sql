-- Migration: E2E encryption key registry + Groups feature
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- ── Public key registry ──────────────────────────────────────────────────────
-- Stores each user's ECDH P-256 public key (SPKI, base64).
-- The private key NEVER leaves the device; only the public key is stored here.

create table if not exists user_keys (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  public_key text not null,
  updated_at bigint not null default (extract(epoch from now()) * 1000)
);

alter table user_keys enable row level security;

-- Anyone can read a public key (needed to encrypt messages to that user)
create policy "public keys readable by all authenticated users"
  on user_keys for select
  using (auth.role() = 'authenticated');

-- Only the key owner can upsert their own key
create policy "users can upsert own key"
  on user_keys for insert
  with check (auth.uid() = user_id);

create policy "users can update own key"
  on user_keys for update
  using (auth.uid() = user_id);

-- ── Groups ───────────────────────────────────────────────────────────────────

create table if not exists groups (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  avatar          text not null default '👥',
  created_by      uuid not null references users(id) on delete cascade,
  created_at      bigint not null default (extract(epoch from now()) * 1000),
  -- The creator's ECDH public key at time of group creation.
  -- Members need this to decrypt their copy of the group key.
  creator_pub_key text
);

alter table groups enable row level security;

-- Group is visible if you're a member
create policy "group visible to members"
  on groups for select
  using (
    exists (
      select 1 from group_members gm
      where gm.group_id = id and gm.user_id = auth.uid()
    )
  );

create policy "authenticated users can create groups"
  on groups for insert
  with check (auth.uid() = created_by);

-- ── Group members ────────────────────────────────────────────────────────────

create table if not exists group_members (
  group_id      uuid not null references groups(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  role          text not null check (role in ('admin', 'member')) default 'member',
  joined_at     bigint not null default (extract(epoch from now()) * 1000),
  -- This member's copy of the group encryption key,
  -- encrypted using ECDH(creator_private_key, this_member_public_key).
  encrypted_key text,
  primary key (group_id, user_id)
);

alter table group_members enable row level security;

-- Members can see their own rows and other members of shared groups
create policy "group members visible to group"
  on group_members for select
  using (
    exists (
      select 1 from group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid()
    )
  );

create policy "admins and creator can add members"
  on group_members for insert
  with check (
    exists (
      select 1 from group_members gm
      where gm.group_id = group_id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
    or
    exists (
      select 1 from groups g
      where g.id = group_id and g.created_by = auth.uid()
    )
  );

-- ── Group messages ────────────────────────────────────────────────────────────
-- Messages are encrypted client-side (AES-256-GCM with the group key).
-- The `text` column holds the encrypted JSON payload.

create table if not exists group_messages (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  from_user_id  uuid not null references users(id) on delete cascade,
  from_name     text not null default '',
  text          text not null,   -- encrypted JSON: { _e2e: "group", iv, ct }
  timestamp     bigint not null default (extract(epoch from now()) * 1000),
  delivered     boolean not null default false
);

create index if not exists group_messages_group_ts on group_messages(group_id, timestamp);

alter table group_messages enable row level security;

-- Only group members can read messages
create policy "group messages readable by members"
  on group_messages for select
  using (
    exists (
      select 1 from group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid()
    )
  );

-- Only group members can send messages
create policy "group members can insert messages"
  on group_messages for insert
  with check (
    auth.uid() = from_user_id
    and exists (
      select 1 from group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid()
    )
  );

-- Delivery tracking: members can mark messages as delivered
create policy "members can update delivered flag"
  on group_messages for update
  using (
    exists (
      select 1 from group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid()
    )
  );
