import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { getDatabase, ref, push, onValue, set, query, orderByChild, limitToLast } from 'firebase/database';
import type { Backend, BackendMessage } from './types';

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
      confirmationResult: await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier as RecaptchaVerifier),
    };
  },

  async confirmCode(confirmationResult: any, code: string) {
    return confirmationResult.confirm(code);
  },

  async logOut() {
    return signOut(auth);
  },

  onAuthChange(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  },

  async createUserProfile(userId: string, phoneNumber: string, displayName: string = '') {
    return set(ref(db, `users/${userId}`), {
      phone: phoneNumber,
      displayName: displayName || phoneNumber,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      online: true,
    });
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

  onIncomingMessages(userId: string, callback: (message: BackendMessage) => void): () => void {
    const messagesRef = ref(db, 'messages');
    const q = query(messagesRef, orderByChild('to'), limitToLast(100));

    const unsubscribe = onValue(q, (snapshot) => {
      snapshot.forEach((childSnapshot) => {
        const message = childSnapshot.val() as any;
        if (message.to === userId && !message.delivered) {
          callback({
            id: childSnapshot.key as string,
            from: message.from,
            to: message.to,
            text: message.text,
            timestamp: message.timestamp,
            delivered: message.delivered,
          });

          const messageId = childSnapshot.key as string;
          set(ref(db, `messages/${messageId}/delivered`), true);

          setTimeout(() => {
            set(ref(db, `messages/${messageId}`), null);
          }, 1000);
        }
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

    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (!isActive) return;

      let found: any = null;
      snapshot.forEach((childSnapshot) => {
        const user = childSnapshot.val();
        if (user.phone === phoneNumber) {
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
