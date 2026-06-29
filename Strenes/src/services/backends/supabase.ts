import { createClient } from '@supabase/supabase-js';
import type { Backend, BackendMessage, BackendContact, BackendUser } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const supabaseBackend: Backend = {
  // Auth - using Supabase built-in phone auth
  async setupRecaptcha() {
    // Supabase doesn't require reCAPTCHA setup - it's built-in
    return { type: 'supabase' };
  },

  async signInWithPhone(phoneNumber: string) {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: phoneNumber,
    });
    if (error) throw error;
    return { confirmationResult: data };
  },

  async confirmCode(result: any, code: string) {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: result.user?.phone || '',
      token: code,
      type: 'sms',
    });
    if (error) throw error;
    return data;
  },

  async logOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  onAuthChange(callback: (user: any) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((_, session) => {
      callback(session?.user || null);
    });
    return () => data?.subscription?.unsubscribe();
  },

  // User Profile
  async createUserProfile(userId: string, phoneNumber: string, displayName: string = '') {
    const { error } = await supabase
      .from('users')
      .upsert({
        id: userId,
        phone: phoneNumber,
        display_name: displayName || phoneNumber,
        created_at: Date.now(),
        last_seen: Date.now(),
        online: true,
      });
    if (error) throw error;
  },

  async updateUserStatus(userId: string, online: boolean) {
    const { error } = await supabase
      .from('users')
      .update({ online, last_seen: Date.now() })
      .eq('id', userId);
    if (error) throw error;
  },

  onUserStatusChange(userId: string, callback: (data: BackendUser) => void): () => void {
    // Poll for user status changes (simple implementation)
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        callback(data as BackendUser);
      }
    }, 2000);

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

  onIncomingMessages(userId: string, callback: (message: BackendMessage) => void): () => void {
    let lastProcessed = new Set<string>();
    let isActive = true;

    // Poll for new messages
    const pollMessages = async () => {
      if (!isActive) return;

      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('to_user_id', userId)
        .eq('delivered', false);

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      for (const msg of messages || []) {
        if (!lastProcessed.has(msg.id)) {
          lastProcessed.add(msg.id);

          callback({
            id: msg.id,
            from: msg.from_user_id,
            to: msg.to_user_id,
            text: msg.text,
            timestamp: msg.timestamp,
            delivered: msg.delivered,
          });

          // Mark as delivered
          await supabase
            .from('messages')
            .update({ delivered: true })
            .eq('id', msg.id);

          // Delete after delay
          setTimeout(() => {
            supabase.from('messages').delete().eq('id', msg.id);
          }, 1000);
        }
      }
    };

    // Poll every 1 second
    const interval = setInterval(pollMessages, 1000);
    pollMessages(); // Check immediately

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
        contact_phone: contactPhone,
        added_at: Date.now(),
      });
    if (error) throw error;
  },

  onContactsChange(userId: string, callback: (contacts: Record<string, BackendContact>) => void): () => void {
    let isActive = true;

    const fetchContacts = async () => {
      if (!isActive) return;

      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*, users!contact_user_id(online, display_name)')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching contacts:', error);
        return;
      }

      const contactMap: Record<string, BackendContact> = {};
      (contacts || []).forEach((contact: any) => {
        contactMap[contact.contact_user_id] = {
          userId: contact.user_id,
          contactUserId: contact.contact_user_id,
          phone: contact.contact_phone,
          addedAt: contact.added_at,
          displayName: contact.users?.display_name,
          online: contact.users?.online,
        };
      });

      callback(contactMap);
    };

    // Poll every 2 seconds
    const interval = setInterval(fetchContacts, 2000);
    fetchContacts(); // Fetch immediately

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  },

  onUserSearch(phoneNumber: string, callback: (user: BackendUser | null) => void): () => void {
    let isActive = true;

    const search = async () => {
      if (!isActive) return;

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phoneNumber)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Search error:', error);
        return;
      }

      if (isActive && data) {
        callback({
          id: data.id,
          phone: data.phone,
          displayName: data.display_name,
          createdAt: data.created_at,
          lastSeen: data.last_seen,
          online: data.online,
        });
      } else if (isActive) {
        callback(null);
      }
    };

    search();

    return () => {
      isActive = false;
    };
  },
};
