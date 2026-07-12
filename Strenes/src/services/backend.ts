// Backend abstraction layer - switch between Firebase and Supabase
import type { Backend } from './backends/types';
import { firebaseBackend } from './backends/firebase';
import { supabaseBackend } from './backends/supabase';
import {
  getOrCreateKeyPair,
  getPublicKeyB64,
  encryptMessage,
  decryptMessage,
  packEncrypted,
  unpackEncrypted,
} from '../crypto';

const backendType = (import.meta.env.VITE_BACKEND || 'supabase') as 'firebase' | 'supabase';

export const backend: Backend = backendType === 'firebase' ? firebaseBackend : supabaseBackend;

export const getBackendName = () => backendType;

// Publish this device's public key on first use (fire-and-forget — non-fatal if it fails)
let _pubKeyPublished = false;
async function ensureKeyPublished(userId: string) {
  if (_pubKeyPublished || !backend.publishPublicKey) return;
  try {
    const pub = await getPublicKeyB64();
    await backend.publishPublicKey(userId, pub);
    _pubKeyPublished = true;
  } catch { /* non-fatal */ }
}

/** Encrypt a DM if we have the recipient's public key; fall back to plaintext. */
export async function sendMessage(fromUserId: string, toUserId: string, text: string): Promise<string> {
  await ensureKeyPublished(fromUserId);
  let wireText = text;
  if (backend.getPublicKey) {
    try {
      const theirPub = await backend.getPublicKey(toUserId);
      if (theirPub) {
        const kp = await getOrCreateKeyPair();
        const { iv, ct } = await encryptMessage(text, kp.privateKey, theirPub);
        wireText = packEncrypted(iv, ct, 'dm');
      }
    } catch { /* fall back to plaintext */ }
  }
  return backend.sendMessage(fromUserId, toUserId, wireText);
}

/** Decrypt an incoming DM if it's encrypted; return plaintext otherwise. */
export async function decryptIncoming(fromUserId: string, rawText: string): Promise<string> {
  const enc = unpackEncrypted(rawText);
  if (!enc || enc.type !== 'dm') return rawText;
  if (!backend.getPublicKey) return rawText;
  try {
    const senderPub = await backend.getPublicKey(fromUserId);
    if (!senderPub) return rawText;
    const kp = await getOrCreateKeyPair();
    return await decryptMessage(enc.iv, enc.ct, kp.privateKey, senderPub);
  } catch {
    return '🔒 (encrypted — key mismatch)';
  }
}

// Export everything else from the backend
export const {
  setupRecaptcha,
  signInWithPhone,
  confirmCode,
  signInWithoutSms,
  logOut,
  onAuthChange,
  createUserProfile,
  getUserProfile,
  updateUserStatus,
  onUserStatusChange,
  onIncomingMessages,
  addContact,
  onContactsChange,
  onUserSearch,
} = backend;

// Re-export types
export type { Backend, BackendUser, BackendAuthUser, BackendMessage, BackendContact } from './backends/types';
