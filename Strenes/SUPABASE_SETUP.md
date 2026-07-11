# Supabase Setup Guide

## Quick Start (5 minutes)

You've already created your Supabase project at: `https://quuxpycnybmzpdykvwql.supabase.co`

### Step 1: Create Database Tables

Go to **Supabase Dashboard → SQL Editor** and run this SQL:

```sql
-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  phone TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at BIGINT,
  last_seen BIGINT,
  online BOOLEAN DEFAULT false
);

-- Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id),
  to_user_id UUID NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  delivered BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  contact_user_id UUID NOT NULL REFERENCES users(id),
  contact_phone TEXT NOT NULL,
  added_at BIGINT NOT NULL,
  UNIQUE(user_id, contact_user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_messages_to_user ON messages(to_user_id);
CREATE INDEX idx_messages_from_user ON messages(from_user_id);
CREATE INDEX idx_contacts_user ON contacts(user_id);
CREATE INDEX idx_users_phone ON users(phone);
```

### Step 2: Set Up Row Level Security (RLS)

Go to **Supabase Dashboard → Authentication → Policies** and enable RLS for each table:

#### Users Table Policies
```sql
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can read other users (for contact discovery)
CREATE POLICY "Users can read all profiles" ON users
  FOR SELECT USING (true);

-- Users can update own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert own profile
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);
```

#### Messages Table Policies
```sql
-- Users can read messages sent to them
CREATE POLICY "Users can read messages to them" ON messages
  FOR SELECT USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

-- Users can insert messages
CREATE POLICY "Users can insert messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- Users can update delivered status
CREATE POLICY "Users can update message delivery" ON messages
  FOR UPDATE USING (auth.uid() = to_user_id);

-- Users can delete messages
CREATE POLICY "Users can delete messages" ON messages
  FOR DELETE USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);
```

#### Contacts Table Policies
```sql
-- Users can read own contacts
CREATE POLICY "Users can read own contacts" ON contacts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert contacts
CREATE POLICY "Users can insert contacts" ON contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete contacts
CREATE POLICY "Users can delete contacts" ON contacts
  FOR DELETE USING (auth.uid() = user_id);
```

### Step 2.5: Account Reclaim Function (required for quick sign-up)

When SMS verification is off (quick sign-up / anonymous sessions), a reinstall
mints a new account. This function lets a fresh sign-in with an already-known
phone number take over the old account — message history and contact links
move with it. Run in **SQL Editor**:

```sql
CREATE OR REPLACE FUNCTION claim_phone_account(p_phone TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_id UUID;
  new_id UUID := auth.uid();
BEGIN
  IF new_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT id INTO old_id FROM users WHERE phone = p_phone;
  IF old_id IS NULL OR old_id = new_id THEN
    RETURN; -- number is free, or already ours
  END IF;

  -- Move message history to the new account
  UPDATE messages SET from_user_id = new_id WHERE from_user_id = old_id;
  UPDATE messages SET to_user_id   = new_id WHERE to_user_id   = old_id;

  -- Move contact links, dropping any that would duplicate existing ones
  DELETE FROM contacts c WHERE c.user_id = old_id
    AND EXISTS (SELECT 1 FROM contacts d
                WHERE d.user_id = new_id AND d.contact_user_id = c.contact_user_id);
  UPDATE contacts SET user_id = new_id WHERE user_id = old_id;
  DELETE FROM contacts c WHERE c.contact_user_id = old_id
    AND EXISTS (SELECT 1 FROM contacts d
                WHERE d.contact_user_id = new_id AND d.user_id = c.user_id);
  UPDATE contacts SET contact_user_id = new_id WHERE contact_user_id = old_id;

  -- Release the phone number
  DELETE FROM users WHERE id = old_id;
END;
$$;

REVOKE ALL ON FUNCTION claim_phone_account(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_phone_account(TEXT) TO authenticated;
```

> ⚠️ **Evaluation only.** Quick sign-up doesn't verify number ownership, so
> this function lets any signed-in user claim any number. Once you attach a
> real SMS provider and OTP verification, remove this function
> (`DROP FUNCTION claim_phone_account;`) or gate it on
> `auth.jwt()->>'phone' = p_phone`.

### Step 2.6: Managed AI Proxy (recommended)

The `ai-proxy` Edge Function (`supabase/functions/ai-proxy/index.ts`) lets the
app use full-quality Gemini AI **without shipping any API key to clients** —
the key lives only in the function's environment. When no key is pasted in
Settings, every AI surface (Commander, rules, moderation, replies) routes
through this proxy automatically.

**Deploy from the dashboard (no CLI needed):**
1. Dashboard → **Edge Functions** → **Deploy a new function** → name it `ai-proxy`
2. Paste the contents of `supabase/functions/ai-proxy/index.ts` into the editor → **Deploy**
3. Dashboard → **Edge Functions → Secrets** → add secret
   `GEMINI_API_KEY` = your Gemini API key

**Or with the Supabase CLI:**
```bash
supabase functions deploy ai-proxy
supabase secrets set GEMINI_API_KEY=<your key>
```

To revoke access later: delete the `GEMINI_API_KEY` secret (or the function).
Clients fall back to on-device AI automatically — nothing breaks.

### Step 3: Enable Phone Authentication

1. Go to **Supabase Dashboard → Authentication → Providers**
2. Enable **Phone** provider
3. Configure phone provider settings
4. Enable **Confirm email** (optional)

### Step 4: Verify Setup

The `.env` file is already configured with:
- `VITE_BACKEND=supabase` (default)
- `VITE_SUPABASE_URL` (your project URL)
- `VITE_SUPABASE_ANON_KEY` (your anon key)

Run the app:
```bash
npm run dev
```

You should see:
- ✅ Auth screen (phone number input)
- ✅ Able to sign up with phone
- ✅ OTP verification works
- ✅ Can create contacts and send messages

## Switching to Firebase Later

When you want to switch to Firebase:

1. Create Firebase project
2. Get Firebase credentials
3. Update `.env`:
   ```
   VITE_BACKEND=firebase
   VITE_FIREBASE_API_KEY=...
   ```
4. That's it! No code changes needed.

## Troubleshooting

### "Connection refused" error
- Check that Supabase project is running
- Verify `VITE_SUPABASE_URL` in `.env`

### "Authentication failed"
- Ensure Phone provider is enabled in Supabase
- Check that user table has correct RLS policies

### "Messages not syncing"
- Verify realtime is enabled for `messages` table
- Check messages table policies

## Security Notes

- The anon key is safe to share (public key)
- Service role key should NEVER be exposed
- RLS policies protect data access
- Messages are automatically deleted after delivery
