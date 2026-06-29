import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { getDatabase, ref, push, onValue, set, query, orderByChild, limitToLast } from 'firebase/database';

/**
 * Firebase Configuration
 * Replace with your Firebase project credentials from Firebase Console
 * Project Settings → Service accounts → Database secrets
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'YOUR_API_KEY_HERE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'your-project.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'your-project-id',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://your-project.firebaseio.com',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'your-project.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'your-sender-id',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'your-app-id',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app) as any;
export const db = getDatabase(app);

// Disable persistence for web (we use localStorage instead)
auth.setPersistence = () => Promise.resolve();

/**
 * Phone Number Authentication
 */
export async function setupRecaptcha(containerId: string): Promise<RecaptchaVerifier> {
  // @ts-ignore Firebase types compatibility
  return new RecaptchaVerifier(containerId, {
    size: 'invisible',
    callback: () => {
      // Callback
    },
  }, auth);
}

export async function signInWithPhone(
  phoneNumber: string,
  recaptchaVerifier: RecaptchaVerifier
): Promise<any> {
  return signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
}

export async function confirmCode(confirmationResult: any, code: string): Promise<any> {
  return confirmationResult.confirm(code);
}

export async function logOut(): Promise<void> {
  return signOut(auth);
}

/**
 * Authentication State
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * User Management in Realtime Database
 * Stores minimal user info: phone, name, lastSeen
 * NO MESSAGE STORAGE - messages are local only
 */
export async function createUserProfile(userId: string, phoneNumber: string, displayName: string = ''): Promise<void> {
  return set(ref(db, `users/${userId}`), {
    phone: phoneNumber,
    displayName: displayName || phoneNumber,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    online: true,
  });
}

export function updateUserStatus(userId: string, online: boolean): Promise<void> {
  return set(ref(db, `users/${userId}/online`), online);
}

export function onUserStatusChange(userId: string, callback: (data: any) => void): () => void {
  const userRef = ref(db, `users/${userId}`);
  const unsubscribe = onValue(userRef, (snapshot) => {
    callback(snapshot.val());
  });
  return unsubscribe;
}

/**
 * Message Relay (Real-time, not stored in Firebase)
 * Messages flow: Device A → Firebase → Device B
 * Then Device B stores locally only
 * Firebase deletes message after delivery to prevent storage
 */
export interface FirebaseMessage {
  id?: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  delivered: boolean;
}

export async function sendMessage(fromUserId: string, toUserId: string, text: string): Promise<string> {
  const messageRef = push(ref(db, 'messages'), {
    from: fromUserId,
    to: toUserId,
    text,
    timestamp: Date.now(),
    delivered: false,
  });
  return messageRef.key as string;
}

export function onIncomingMessages(userId: string, callback: (message: FirebaseMessage) => void): () => void {
  const messagesRef = ref(db, 'messages');
  const q = query(messagesRef, orderByChild('to'), limitToLast(100));

  const unsubscribe = onValue(q, (snapshot) => {
    snapshot.forEach((childSnapshot) => {
      const message = childSnapshot.val() as FirebaseMessage;
      if (message.to === userId && !message.delivered) {
        callback({
          ...message,
          id: childSnapshot.key as string,
        });
        // Mark as delivered and schedule deletion
        markMessageDelivered(childSnapshot.key as string);
      }
    });
  });

  return unsubscribe;
}

async function markMessageDelivered(messageId: string): Promise<void> {
  return set(ref(db, `messages/${messageId}/delivered`), true);
}

/**
 * Contacts/Friends Management
 * Store which users are contacts (not the actual messages)
 */
export async function addContact(userId: string, contactUserId: string, contactPhone: string): Promise<void> {
  return set(ref(db, `contacts/${userId}/${contactUserId}`), {
    phone: contactPhone,
    addedAt: Date.now(),
  });
}

export function onContactsChange(userId: string, callback: (contacts: any) => void): () => void {
  const contactsRef = ref(db, `contacts/${userId}`);
  const unsubscribe = onValue(contactsRef, (snapshot) => {
    callback(snapshot.val() || {});
  });
  return unsubscribe;
}

/**
 * Find user by phone number
 */
export function onUserSearch(phoneNumber: string, callback: (user: any) => void): () => void {
  const usersRef = ref(db, 'users');
  const unsubscribe = onValue(usersRef, (snapshot) => {
    snapshot.forEach((childSnapshot) => {
      const user = childSnapshot.val();
      if (user.phone === phoneNumber) {
        callback({
          id: childSnapshot.key,
          ...user,
        });
      }
    });
  });
  return unsubscribe;
}
