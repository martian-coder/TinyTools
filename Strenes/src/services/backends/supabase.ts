import { createClient } from '@supabase/supabase-js';
import type { Backend, BackendAuthUser, BackendMessage, BackendContact, BackendUser, BackendGroup, BackendGroupMessage } from './types';
import { normalizePhone } from '../../utils/phone';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

function rowToUser(data: any): BackendUser {
  return {
    id: data.id,
    phone: data.phone,
    displayName: data.display_name,
    createdAt: data.created_at,
    lastSeen: data.last_seen,
    online: data.online,
  };
}

export const supabaseBackend: Backend = {
  // Auth - using Supabase built-in phone auth
  async setupRecaptcha() {
    // Supabase doesn't require reCAPTCHA setup - it's built-in
    return { type: 'supabase' };
  },

  async signInWithPhone(phoneNumber: string) {
    const phone = normalizePhone(phoneNumber);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
    // Carry the phone forward: verifyOtp needs it and signInWithOtp's
    // response contains no user object at this stage.
    return { confirmationResult: { phone } };
  },

  async signInWithoutSms(phoneNumber: string): Promise<BackendAuthUser> {
    const phone = normalizePhone(phoneNumber);
    // Reuse an existing anonymous session if one is already active so a
    // re-run of sign-up doesn't mint a second account on the same device.
    const { data: existing } = await supabase.auth.getSession();
    let userId = existing.session?.user?.id;
    if (!userId) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        throw new Error(
          `Quick sign-up unavailable: ${error.message}. ` +
          'Enable "Anonymous sign-ins" in Supabase → Authentication → Sign In / Up.'
        );
      }
      userId = data.user?.id;
    }
    if (!userId) throw new Error('Sign-up succeeded but no session was returned.');
    return { userId, phone };
  },

  async confirmCode(result, code: string): Promise<BackendAuthUser> {
    const phone = result?.confirmationResult?.phone;
    if (!phone) throw new Error('Missing phone number — restart sign-in.');
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: 'sms',
    });
    if (error) throw error;
    const user = data.user ?? data.session?.user;
    if (!user) throw new Error('Verification succeeded but no session was returned.');
    return { userId: user.id, phone };
  },

  async signInWithEmailOtp(email: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    if (error) throw new Error(error.message);
  },

  async confirmEmailCode(email: string, code: string, phoneNumber: string): Promise<BackendAuthUser> {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });
    if (error) throw new Error(error.message);
    const user = data.user ?? data.session?.user;
    if (!user) throw new Error('Verification succeeded but no session was returned.');
    // The app's identity stays the PHONE number; email is the verification
    // channel (and shows up in the Supabase auth dashboard for tracking).
    return { userId: user.id, phone: normalizePhone(phoneNumber) };
  },

  async phoneHasPin(phoneNumber: string): Promise<boolean | null> {
    const { data, error } = await supabase.rpc('phone_has_pin', {
      p_phone: normalizePhone(phoneNumber),
    });
    if (error) return null; // offline or migration 004 not run — caller degrades
    return data === true;
  },

  async signInWithPin(phoneNumber: string, pin: string): Promise<BackendAuthUser & { isNew: boolean }> {
    const phone = normalizePhone(phoneNumber);
    // Underlying session is anonymous auth (same as quick sign-up); the PIN
    // RPC is what gates ownership of the phone number.
    const { data: existing } = await supabase.auth.getSession();
    let userId = existing.session?.user?.id;
    if (!userId) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        throw new Error(
          `Sign-in unavailable: ${error.message}. ` +
          'Enable "Anonymous sign-ins" in Supabase → Authentication → Sign In / Up.'
        );
      }
      userId = data.user?.id;
    }
    if (!userId) throw new Error('Sign-in succeeded but no session was returned.');

    const { data, error } = await supabase.rpc('claim_phone_with_pin', {
      p_phone: phone,
      p_pin: pin,
    });
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        throw new Error('PIN sign-in is not set up on the server yet — run migration 004_phone_pin_auth.sql in Supabase.');
      }
      throw new Error(error.message);
    }
    return { userId, phone, isNew: data === 'registered' };
  },

  async logOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  onAuthChange(callback: (user: any) => void): () => void {
    // Report the persisted session immediately so a page reload doesn't
    // bounce the user back to the sign-in screen while the SDK warms up.
    supabase.auth.getSession().then(({ data }) => {
      callback(data.session?.user
        ? { uid: data.session.user.id, phoneNumber: data.session.user.phone || '' }
        : null);
    });
    const { data } = supabase.auth.onAuthStateChange((_, session) => {
      callback(session?.user
        ? { uid: session.user.id, phoneNumber: session.user.phone || '' }
        : null);
    });
    return () => data?.subscription?.unsubscribe();
  },

  // User Profile
  async createUserProfile(userId: string, phoneNumber: string, displayName: string = '') {
    const phone = normalizePhone(phoneNumber);
    const profile = {
      id: userId,
      phone,
      display_name: displayName || phone,
      created_at: Date.now(),
      last_seen: Date.now(),
      online: true,
    };
    const { error } = await supabase.from('users').upsert(profile);
    if (!error) return;

    // 23505: this phone already belongs to another account — typically a
    // previous install whose anonymous session is gone. Reclaim it server-side
    // (moves message history and contact links to this account, then frees the
    // number) and retry once.
    if (error.code === '23505') {
      const { error: claimErr } = await supabase.rpc('claim_phone_account', { p_phone: phone });
      if (claimErr) {
        throw new Error(
          'This number is registered to a previous install and could not be ' +
          `reclaimed automatically (${claimErr.message}). Run the ` +
          'claim_phone_account SQL from SUPABASE_SETUP.md, or delete the old ' +
          'row in Supabase → Table Editor → users.'
        );
      }
      const { error: retryErr } = await supabase.from('users').upsert(profile);
      if (retryErr) throw retryErr;
      return;
    }
    throw error;
  },

  async getUserProfile(userId: string): Promise<BackendUser | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return rowToUser(data);
  },

  async updateUserStatus(userId: string, online: boolean) {
    const { error } = await supabase
      .from('users')
      .update({ online, last_seen: Date.now() })
      .eq('id', userId);
    if (error) throw error;
  },

  onUserStatusChange(userId: string, callback: (data: BackendUser) => void): () => void {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (data) callback(rowToUser(data));
    }, 5000);
    return () => clearInterval(interval);
  },

  // Messaging
  async sendMessage(fromUserId: string, toUserId: string, text: string): Promise<string> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        text,
        timestamp: Date.now(),
        delivered: false,
      })
      .select('id');

    if (error) throw error;
    return data?.[0]?.id || '';
  },

  onIncomingMessages(userId: string, callback: (message: BackendMessage) => void | Promise<void>): () => void {
    const processed = new Set<string>();
    let isActive = true;
    let polling = false;

    const pollMessages = async () => {
      if (!isActive || polling) return;
      polling = true;
      try {
        const { data: messages, error } = await supabase
          .from('messages')
          .select('*')
          .eq('to_user_id', userId)
          .eq('delivered', false)
          .order('timestamp', { ascending: true });

        if (error) {
          console.error('Error fetching messages:', error);
          return;
        }

        for (const msg of messages || []) {
          if (!isActive || processed.has(msg.id)) continue;
          try {
            // The callback persisting the message locally is the only durable
            // copy — await it BEFORE removing the relay copy so a crash or
            // classification error never loses a message (it retries next poll).
            await callback({
              id: msg.id,
              from: msg.from_user_id,
              to: msg.to_user_id,
              text: msg.text,
              timestamp: msg.timestamp,
              delivered: msg.delivered,
            });
            processed.add(msg.id);
            await supabase.from('messages').update({ delivered: true }).eq('id', msg.id);
            await supabase.from('messages').delete().eq('id', msg.id);
          } catch (err) {
            console.error('Message handling failed, will retry:', err);
          }
        }
        // Bound memory on long sessions.
        if (processed.size > 500) processed.clear();
      } finally {
        polling = false;
      }
    };

    const interval = setInterval(pollMessages, 2000);
    pollMessages();

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  },

  // Contacts
  async addContact(userId: string, contactUserId: string, contactPhone: string) {
    const { error } = await supabase
      .from('contacts')
      .upsert({
        user_id: userId,
        contact_user_id: contactUserId,
        contact_phone: normalizePhone(contactPhone),
        added_at: Date.now(),
      }, { onConflict: 'user_id,contact_user_id' });
    if (error) throw error;
  },

  onContactsChange(userId: string, callback: (contacts: Record<string, BackendContact>) => void): () => void {
    let isActive = true;

    const fetchContacts = async () => {
      if (!isActive) return;

      // Two plain queries instead of a PostgREST embedded join: the schema has
      // no FK from contacts.contact_user_id → users.id, so `users!...` embeds 400.
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching contacts:', error);
        return;
      }

      const ids = (contacts || []).map((c: any) => c.contact_user_id);
      const profiles: Record<string, any> = {};
      if (ids.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, display_name, online, phone')
          .in('id', ids);
        for (const u of users || []) profiles[u.id] = u;
      }

      const contactMap: Record<string, BackendContact> = {};
      (contacts || []).forEach((contact: any) => {
        const profile = profiles[contact.contact_user_id];
        contactMap[contact.contact_user_id] = {
          userId: contact.user_id,
          contactUserId: contact.contact_user_id,
          phone: profile?.phone ?? contact.contact_phone,
          addedAt: contact.added_at,
          displayName: profile?.display_name,
          online: profile?.online,
        };
      });

      if (isActive) callback(contactMap);
    };

    const interval = setInterval(fetchContacts, 5000);
    fetchContacts();

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  },

  // ── Encryption key registry ──────────────────────────────────────────────

  async publishPublicKey(userId: string, publicKeyB64: string): Promise<void> {
    const { error } = await supabase
      .from('user_keys')
      .upsert({ user_id: userId, public_key: publicKeyB64, updated_at: Date.now() }, { onConflict: 'user_id' });
    if (error) throw error;
  },

  async getPublicKey(userId: string): Promise<string | null> {
    const { data } = await supabase
      .from('user_keys')
      .select('public_key')
      .eq('user_id', userId)
      .maybeSingle();
    return data?.public_key ?? null;
  },

  // ── Groups ───────────────────────────────────────────────────────────────

  async createGroup(
    creatorId: string,
    name: string,
    avatar: string,
    memberIds: string[],
    encryptedKeys: Record<string, string>,
    creatorPubKey: string,
  ): Promise<string> {
    const { data, error } = await supabase
      .from('groups')
      .insert({ name, avatar, created_by: creatorId, created_at: Date.now(), creator_pub_key: creatorPubKey })
      .select('id')
      .single();
    if (error) throw error;
    const groupId = data.id as string;

    const allIds = [...new Set([creatorId, ...memberIds])];
    const memberRows = allIds.map(uid => ({
      group_id: groupId,
      user_id: uid,
      role: uid === creatorId ? 'admin' : 'member',
      joined_at: Date.now(),
      encrypted_key: encryptedKeys[uid] ?? null,
    }));
    const { error: mErr } = await supabase.from('group_members').insert(memberRows);
    if (mErr) throw mErr;
    return groupId;
  },

  async getGroup(groupId: string, userId: string): Promise<BackendGroup | null> {
    const [gRes, mRes] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).maybeSingle(),
      supabase.from('group_members').select('*').eq('group_id', groupId),
    ]);
    if (!gRes.data) return null;
    const myRow = (mRes.data || []).find((r: any) => r.user_id === userId);
    return {
      id: gRes.data.id,
      name: gRes.data.name,
      avatar: gRes.data.avatar,
      createdBy: gRes.data.created_by,
      createdAt: gRes.data.created_at,
      creatorPubKey: gRes.data.creator_pub_key,
      encryptedKey: myRow?.encrypted_key ?? undefined,
      members: (mRes.data || []).map((r: any) => ({
        userId: r.user_id, role: r.role, joinedAt: r.joined_at,
      })),
    };
  },

  async getUserGroups(userId: string): Promise<BackendGroup[]> {
    const { data: memberRows } = await supabase
      .from('group_members')
      .select('group_id, role, joined_at, encrypted_key')
      .eq('user_id', userId);
    if (!memberRows?.length) return [];

    const groupIds = memberRows.map((r: any) => r.group_id);
    const { data: groups } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds);

    const { data: allMembers } = await supabase
      .from('group_members')
      .select('group_id, user_id, role, joined_at')
      .in('group_id', groupIds);

    return (groups || []).map((g: any) => {
      const myRow = memberRows.find((r: any) => r.group_id === g.id);
      return {
        id: g.id, name: g.name, avatar: g.avatar,
        createdBy: g.created_by, createdAt: g.created_at,
        creatorPubKey: g.creator_pub_key,
        encryptedKey: myRow?.encrypted_key ?? undefined,
        members: (allMembers || [])
          .filter((m: any) => m.group_id === g.id)
          .map((m: any) => ({ userId: m.user_id, role: m.role, joinedAt: m.joined_at })),
      };
    });
  },

  async addGroupMember(groupId: string, userId: string, encryptedKey: string): Promise<void> {
    const { error } = await supabase.from('group_members').upsert({
      group_id: groupId, user_id: userId, role: 'member',
      joined_at: Date.now(), encrypted_key: encryptedKey,
    }, { onConflict: 'group_id,user_id' });
    if (error) throw error;
  },

  async sendGroupMessage(groupId: string, fromUserId: string, fromName: string, text: string): Promise<string> {
    const { data, error } = await supabase
      .from('group_messages')
      .insert({ group_id: groupId, from_user_id: fromUserId, from_name: fromName, text, timestamp: Date.now(), delivered: false })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  },

  onGroupMessages(userId: string, callback: (msg: BackendGroupMessage) => void | Promise<void>): () => void {
    let isActive = true;
    const processed = new Set<string>();

    const poll = async () => {
      if (!isActive) return;
      // Get groups this user belongs to
      const { data: memberRows } = await supabase
        .from('group_members').select('group_id').eq('user_id', userId);
      const groupIds = (memberRows || []).map((r: any) => r.group_id);
      if (!groupIds.length) return;

      const { data: msgs } = await supabase
        .from('group_messages')
        .select('*')
        .in('group_id', groupIds)
        .neq('from_user_id', userId)  // don't deliver own messages back
        .eq('delivered', false)
        .order('timestamp', { ascending: true });

      for (const msg of msgs || []) {
        if (!isActive || processed.has(msg.id)) continue;
        try {
          await callback({
            id: msg.id, groupId: msg.group_id,
            fromUserId: msg.from_user_id, fromName: msg.from_name,
            text: msg.text, timestamp: msg.timestamp,
          });
          processed.add(msg.id);
          await supabase.from('group_messages').update({ delivered: true }).eq('id', msg.id);
        } catch { /* retry next tick */ }
      }
      if (processed.size > 500) processed.clear();
    };

    const interval = setInterval(poll, 2500);
    poll();
    return () => { isActive = false; clearInterval(interval); };
  },

  onUserSearch(phoneNumber: string, callback: (user: BackendUser | null, error?: string) => void): () => void {
    let isActive = true;

    const search = async () => {
      const phone = normalizePhone(phoneNumber);

      // Exact E.164 match first.
      const exact = await supabase.from('users').select('*').eq('phone', phone).maybeSingle();
      if (!isActive) return;
      if (exact.error) {
        console.error('Search error:', exact.error);
        callback(null, exact.error.message);
        return;
      }
      if (exact.data) { callback(rowToUser(exact.data)); return; }

      // Forgiving fallback: match on the trailing 10 digits so a missing or
      // different country-code prefix still finds the account.
      const tail = phone.replace(/\D/g, '').slice(-10);
      if (tail.length === 10) {
        const fuzzy = await supabase.from('users').select('*').like('phone', `%${tail}`).limit(1);
        if (!isActive) return;
        if (fuzzy.error) {
          console.error('Search error:', fuzzy.error);
          callback(null, fuzzy.error.message);
          return;
        }
        if (fuzzy.data?.[0]) { callback(rowToUser(fuzzy.data[0])); return; }
      }

      callback(null);
    };

    search();

    return () => {
      isActive = false;
    };
  },
};
