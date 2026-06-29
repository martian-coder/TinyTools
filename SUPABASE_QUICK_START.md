# Supabase Quick Start Guide 🚀

## Status: Ready to Test! ✅

Your Strenes app is now configured to use **Supabase as the backend**.

### What You've Got:
- ✅ **Supabase Project Created** (quuxpycnybmzpdykvwql)
- ✅ **API URL & Anon Key Added** to `.env`
- ✅ **Dual-Backend System** (Supabase now, Firebase later)
- ✅ **App Ready to Run**

---

## Next Steps (Choose One)

### Option 1: Quick Test (10 minutes)
Just run the app and test the UI:

```bash
cd Strenes
npm run dev
```

Visit: http://localhost:5173/strenes/

You'll see the **Auth screen**. This confirms the app loads correctly, but you won't be able to sign up yet because the database tables don't exist.

---

### Option 2: Full Setup (15 minutes) - Recommended for Testing
Set up Supabase database + test 2-device messaging:

#### Step 1: Create Database Tables

1. Go to **Supabase Dashboard**: https://app.supabase.com
2. Select your project (quuxpycnybmzpdykvwql)
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**
5. Paste this SQL and click **Run**:

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
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  text TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  delivered BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_user_id UUID NOT NULL,
  contact_phone TEXT NOT NULL,
  added_at BIGINT NOT NULL,
  UNIQUE(user_id, contact_user_id)
);

-- Create indexes
CREATE INDEX idx_messages_to_user ON messages(to_user_id);
CREATE INDEX idx_messages_from_user ON messages(from_user_id);
CREATE INDEX idx_contacts_user ON contacts(user_id);
CREATE INDEX idx_users_phone ON users(phone);
```

#### Step 2: Enable Phone Authentication

1. Go to **Authentication** → **Providers**
2. Find **Phone** provider
3. Toggle it **ON**
4. Click **Save**

#### Step 3: Enable Row Level Security (RLS)

Go to **Authentication** → **Policies** and add:

**For `users` table:**
```
Policy 1 (SELECT): auth.uid() = id OR true
Policy 2 (UPDATE): auth.uid() = id
Policy 3 (INSERT): auth.uid() = id
```

**For `messages` table:**
```
Policy 1 (SELECT): auth.uid() = to_user_id OR auth.uid() = from_user_id
Policy 2 (INSERT): auth.uid() = from_user_id
Policy 3 (UPDATE): auth.uid() = to_user_id
Policy 4 (DELETE): auth.uid() = to_user_id OR auth.uid() = from_user_id
```

**For `contacts` table:**
```
Policy 1 (SELECT): auth.uid() = user_id
Policy 2 (INSERT): auth.uid() = user_id
Policy 3 (DELETE): auth.uid() = user_id
```

#### Step 4: Run the App

```bash
npm run dev
```

#### Step 5: Test 2-Device Workflow

**On Device/Phone 1:**
1. Open http://localhost:5173/strenes/ (or build APK if testing on real phone)
2. Enter phone: `+1 555 123 0001` (or any number)
3. Wait for OTP (in Supabase logs: Dashboard → Database → Logs)
4. Enter OTP code
5. Set display name
6. You're logged in!

**On Device/Phone 2:**
1. Same steps but use phone: `+1 555 123 0002`
2. Navigate to **Contacts** tab
3. Search for `+1 555 123 0001`
4. Click **+ Add Contact**

**Back to Device 1:**
1. Go to **Chats** tab
2. Click on the contact
3. Type message: "Hello!"
4. Send

**On Device 2:**
1. Check if message appears in conversation
2. Message should be filtered locally (civility/spam rules)
3. Reply to test 2-way messaging

---

## Troubleshooting

### "Authentication failed"
- Ensure Phone provider is **enabled** in Supabase
- Check that you have internet connection

### "Table doesn't exist"
- Run the SQL script above to create tables
- Verify it executed without errors

### "Messages not appearing"
- Check that Supabase is running (dashboard loads)
- Verify RLS policies are enabled
- Check browser console for errors

### "Network error"
- Verify `.env` has correct `VITE_SUPABASE_URL`
- Check that Supabase project is active
- Refresh the page

---

## What's Happening Behind the Scenes

### Architecture:
```
Device A                Firebase/Supabase              Device B
  ↓                          ↓                            ↓
Auth ──────→ Login ─→ Phone OTP ─→ Store user
Send msg ──→ firebaseSendMessage() ─→ Relay in DB
              ↑                         ↓
         [Messages temporarily      onIncomingMessages()
          stored in DB]              ↓
                              AI filter (local)
                              ↓
                         Store locally only
                         Delete from DB
```

### Key Points:
- ✅ **Supabase relay only** - messages pass through but don't stay
- ✅ **Local filtering** - each device applies AI rules
- ✅ **LocalStorage** - messages persist locally forever
- ✅ **No cloud storage** - your data never stored in cloud

---

## Switching to Firebase Later

When you want to switch to Firebase (for scaling):

1. Get Firebase credentials (same way as before)
2. Update `.env`:
   ```
   VITE_BACKEND=firebase
   VITE_FIREBASE_API_KEY=...
   # ... other Firebase vars
   ```
3. Restart the app
4. **That's it!** Same API, different backend

No code changes needed. The abstraction layer handles everything.

---

## File Structure

```
Strenes/
├── .env                    ← Supabase credentials (already filled)
├── .env.example           ← Template for both backends
├── SUPABASE_SETUP.md      ← Full setup guide with SQL
├── src/
│   ├── services/
│   │   ├── backend.ts     ← Abstraction layer (switches backends)
│   │   └── backends/
│   │       ├── types.ts   ← Backend interface definition
│   │       ├── firebase.ts ← Firebase implementation
│   │       └── supabase.ts ← Supabase implementation
│   ├── screens/
│   │   ├── Auth.tsx       ← Uses backend abstraction
│   │   ├── Contacts.tsx   ← Uses backend abstraction
│   │   ├── Conversation.tsx ← Uses backend abstraction
│   │   └── ...
│   └── App.tsx            ← Uses backend abstraction
```

---

## Key Environment Variables

```bash
# Backend to use
VITE_BACKEND=supabase

# Supabase (currently active)
VITE_SUPABASE_URL=https://quuxpycnybmzpdykvwql.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ... (your key)

# Firebase (for later)
# VITE_FIREBASE_API_KEY=...
# VITE_FIREBASE_AUTH_DOMAIN=...
# ... etc
```

---

## Testing Checklist

- [ ] App loads at http://localhost:5173/strenes/
- [ ] Auth screen displays
- [ ] Can sign up with phone number
- [ ] OTP verification works
- [ ] Can set display name
- [ ] Can navigate to Contacts
- [ ] Can search for another user (add second account first)
- [ ] Can add contact
- [ ] Can send message in Chats
- [ ] Message appears on other device
- [ ] Message filtering works (try offensive text)

---

## Support

For issues with:
- **Supabase**: Check SUPABASE_SETUP.md or https://supabase.com/docs
- **App Code**: Check PHASE_M3_COMPLETION.md
- **Backend Switching**: See "Switching to Firebase Later" section above

---

## Next Phase

Once you've tested 2-device messaging with Supabase:

1. **M4**: E2E Encryption, Push Notifications, Voice/Video
2. **M4**: Migrate to Firebase when user base grows
3. **M4**: Publish to Play Store

---

**You're all set to test!** 🎉

Start with: `npm run dev`

Happy testing! 📱✨
