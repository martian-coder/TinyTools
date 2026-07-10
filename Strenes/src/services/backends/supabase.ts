import { createClient } from '@supabase/supabase-js';
import type { Backend, BackendAuthUser, BackendMessage, BackendContact, BackendUser } from './types';
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
    const { error } = await supabase
      .from('users')
      .upsert({
        id: userId,
        phone,
        display_name: displayName || phone,
        created_at: Date.now(),
        last_seen: Date.now(),
        online: true,
      });
    if (error) throw error;
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
