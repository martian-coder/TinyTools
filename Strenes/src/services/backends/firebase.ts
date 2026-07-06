import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { getDatabase, ref, push, onValue, set, get, query, orderByChild, limitToLast } from 'firebase/database';
import type { Backend, BackendAuthUser, BackendMessage, BackendUser } from './types';
import { normalizePhone } from '../../utils/phone';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'YOUR_API_KEY_HERE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'your-project.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'your-project-id',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://your-project.firebaseio.com',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'your-project.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'your-sender-id',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'your-app-id',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app) as any;
export const db = getDatabase(app);

export const firebaseBackend: Backend = {
  async setupRecaptcha(containerId: string) {
    // @ts-ignore Firebase types compatibility
    return new RecaptchaVerifier(containerId, {
      size: 'invisible',
      callback: () => {},
    }, auth);
  },

  async signInWithPhone(phoneNumber: string, recaptchaVerifier: any) {
    return {
      confirmationResult: await signInWithPhoneNumber(auth, normalizePhone(phoneNumber), recaptchaVerifier as RecaptchaVerifier),
    };
  },

  async confirmCode(result, code: string): Promise<BackendAuthUser> {
    const confirmation = result?.confirmationResult;
    if (!confirmation?.confirm) throw new Error('Missing verification state — restart sign-in.');
    const credential = await confirmation.confirm(code);
    return {
      userId: credential.user.uid,
      phone: credential.user.phoneNumber || '',
    };
  },

  async logOut() {
    return signOut(auth);
  },

  onAuthChange(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  },

  async createUserProfile(userId: string, phoneNumber: string, displayName: string = '') {
    const phone = normalizePhone(phoneNumber);
    return set(ref(db, `users/${userId}`), {
      phone,
      displayName: displayName || phone,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      online: true,
    });
  },

  async getUserProfile(userId: string): Promise<BackendUser | null> {
    try {
      const snapshot = await get(ref(db, `users/${userId}`));
      if (!snapshot.exists()) return null;
      const data = snapshot.val();
      return {
        id: userId,
        phone: data.phone,
        displayName: data.displayName,
        createdAt: data.createdAt,
        lastSeen: data.lastSeen,
        online: data.online,
      };
    } catch {
      return null;
    }
  },

  async updateUserStatus(userId: string, online: boolean) {
    return set(ref(db, `users/${userId}/online`), online);
  },

  onUserStatusChange(userId: string, callback: (data: any) => void): () => void {
    const userRef = ref(db, `users/${userId}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      callback(snapshot.val());
    });
    return unsubscribe;
  },

  async sendMessage(fromUserId: string, toUserId: string, text: string): Promise<string> {
    const messageRef = push(ref(db, 'messages'), {
      from: fromUserId,
      to: toUserId,
      text,
      timestamp: Date.now(),
      delivered: false,
    });
    return messageRef.key as string;
  },

  onIncomingMessages(userId: string, callback: (message: BackendMessage) => void | Promise<void>): () => void {
    const messagesRef = ref(db, 'messages');
    const q = query(messagesRef, orderByChild('to'), limitToLast(100));
    const processed = new Set<string>();

    const unsubscribe = onValue(q, (snapshot) => {
      snapshot.forEach((childSnapshot) => {
        const message = childSnapshot.val() as any;
        const messageId = childSnapshot.key as string;
        if (message.to !== userId || message.delivered || processed.has(messageId)) return;
        processed.add(messageId);

        // Only remove the relay copy after the local store confirms it —
        // that local write is the single durable copy of the message.
        Promise.resolve(callback({
          id: messageId,
          from: message.from,
          to: message.to,
          text: message.text,
          timestamp: message.timestamp,
          delivered: message.delivered,
        })).then(() => {
          set(ref(db, `messages/${messageId}/delivered`), true);
          set(ref(db, `messages/${messageId}`), null);
        }).catch((err) => {
          processed.delete(messageId);
          console.error('Message handling failed, will retry:', err);
        });
      });
    });

    return unsubscribe;
  },

  async addContact(userId: string, contactUserId: string, contactPhone: string) {
    return set(ref(db, `contacts/${userId}/${contactUserId}`), {
      phone: contactPhone,
      addedAt: Date.now(),
    });
  },

  onContactsChange(userId: string, callback: (contacts: Record<string, any>) => void): () => void {
    const contactsRef = ref(db, `contacts/${userId}`);
    const unsubscribe = onValue(contactsRef, (snapshot) => {
      callback(snapshot.val() || {});
    });
    return unsubscribe;
  },

  onUserSearch(phoneNumber: string, callback: (user: any | null) => void): () => void {
    const usersRef = ref(db, 'users');
    let isActive = true;

    const target = normalizePhone(phoneNumber);
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (!isActive) return;

      let found: any = null;
      snapshot.forEach((childSnapshot) => {
        const user = childSnapshot.val();
        if (normalizePhone(user.phone || '') === target) {
          found = { id: childSnapshot.key, ...user };
        }
      });

      callback(found);
    });

    const cleanup = () => {
      isActive = false;
      unsubscribe();
    };

    return cleanup;
  },
};
