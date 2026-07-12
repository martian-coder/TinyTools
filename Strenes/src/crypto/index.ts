/**
 * E2E encryption layer — Web Crypto API (ECDH P-256 + AES-256-GCM).
 *
 * Key lifecycle:
 *  - On first use, generateKeyPair() creates a P-256 ECDH keypair.
 *  - Private key stays in IndexedDB (never leaves device).
 *  - Public key (SPKI, base64) is uploaded to Supabase `user_keys`.
 *
 * 1-to-1 messages:
 *  - encryptMessage(text, myPrivKey, theirPubKey) → { iv, ct } both base64.
 *  - decryptMessage(iv, ct, myPrivKey, senderPubKey) → plaintext.
 *
 * Group messages:
 *  - Group has one random 256-bit AES-GCM key ("group key").
 *  - That group key is encrypted for each member using their public key.
 *  - encryptGroupMessage(text, groupKey) → { iv, ct }.
 *  - decryptGroupMessage(iv, ct, groupKey) → plaintext.
 */

const DB_NAME = 'strenes-keys';
const DB_STORE = 'keypairs';
const DB_KEY = 'myKeypair';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(db: IDBDatabase, key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(db: IDBDatabase, key: string, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const req = tx.objectStore(DB_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function unb64(s: string): Uint8Array<ArrayBuffer> {
  const arr = Uint8Array.from(atob(s), c => c.charCodeAt(0));
  return new Uint8Array(arr.buffer.slice(0) as ArrayBuffer);
}

// ── Key generation ─────────────────────────────────────────────────────────

export interface StoredKeypair {
  publicKeyB64: string;   // SPKI, base64 — safe to publish
  privateKey: CryptoKey;  // non-extractable, stays in IDB
}

export async function generateKeyPair(): Promise<StoredKeypair> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,            // private key is non-extractable
    ['deriveKey'],
  );
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
  return { publicKeyB64: b64(spki), privateKey: pair.privateKey };
}

export async function getOrCreateKeyPair(): Promise<StoredKeypair> {
  const db = await openDB();
  const stored = await dbGet(db, DB_KEY);
  if (stored) return stored as StoredKeypair;

  const kp = await generateKeyPair();
  await dbPut(db, DB_KEY, kp);
  return kp;
}

export async function getPublicKeyB64(): Promise<string> {
  const kp = await getOrCreateKeyPair();
  return kp.publicKeyB64;
}

// ── 1-to-1 encryption ──────────────────────────────────────────────────────

async function deriveSharedKey(myPrivKey: CryptoKey, theirPubB64: string): Promise<CryptoKey> {
  const theirPubKey = await crypto.subtle.importKey(
    'spki', unb64(theirPubB64),
    { name: 'ECDH', namedCurve: 'P-256' },
    false, [],
  );
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPubKey },
    myPrivKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptMessage(
  text: string,
  myPrivKey: CryptoKey,
  theirPubB64: string,
): Promise<{ iv: string; ct: string }> {
  const sharedKey = await deriveSharedKey(myPrivKey, theirPubB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    new TextEncoder().encode(text),
  );
  return { iv: b64(iv.buffer), ct: b64(ct) };
}

export async function decryptMessage(
  ivB64: string,
  ctB64: string,
  myPrivKey: CryptoKey,
  senderPubB64: string,
): Promise<string> {
  const sharedKey = await deriveSharedKey(myPrivKey, senderPubB64);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(ivB64) },
    sharedKey,
    unb64(ctB64),
  );
  return new TextDecoder().decode(plain);
}

// ── Group key helpers ───────────────────────────────────────────────────────

export async function generateGroupKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function exportGroupKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return b64(raw);
}

export async function importGroupKey(b64Key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', unb64(b64Key),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt the raw group key bytes with a member's ECDH public key (ECDH → AES-GCM wrap). */
export async function encryptGroupKeyForMember(
  groupKey: CryptoKey,
  myPrivKey: CryptoKey,
  memberPubB64: string,
): Promise<string> {
  const wrapKey = await deriveSharedKey(myPrivKey, memberPubB64);
  const rawGroupKey = await crypto.subtle.exportKey('raw', groupKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, rawGroupKey);
  // Prepend iv (12 bytes) to wrapped key for a single base64 blob.
  const out = new Uint8Array(12 + wrapped.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(wrapped), 12);
  return b64(out.buffer);
}

export async function decryptGroupKey(
  encryptedB64: string,
  myPrivKey: CryptoKey,
  senderPubB64: string,
): Promise<CryptoKey> {
  const wrapKey = await deriveSharedKey(myPrivKey, senderPubB64);
  const buf = unb64(encryptedB64);
  const iv = buf.slice(0, 12);
  const wrapped = buf.slice(12);
  const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrapKey, wrapped);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// ── Group message encryption ────────────────────────────────────────────────

export async function encryptGroupMessage(
  text: string,
  groupKey: CryptoKey,
): Promise<{ iv: string; ct: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    groupKey,
    new TextEncoder().encode(text),
  );
  return { iv: b64(iv.buffer), ct: b64(ct) };
}

export async function decryptGroupMessage(
  ivB64: string,
  ctB64: string,
  groupKey: CryptoKey,
): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(ivB64) },
    groupKey,
    unb64(ctB64),
  );
  return new TextDecoder().decode(plain);
}

// ── Wire format helpers ─────────────────────────────────────────────────────

/** Wrap an encrypted payload as a JSON string for the relay. */
export function packEncrypted(iv: string, ct: string, type: 'dm' | 'group'): string {
  return JSON.stringify({ _e2e: type, iv, ct });
}

/** Returns null if the string is not an encrypted payload. */
export function unpackEncrypted(
  raw: string,
): { type: 'dm' | 'group'; iv: string; ct: string } | null {
  try {
    const obj = JSON.parse(raw);
    if (obj._e2e === 'dm' || obj._e2e === 'group') {
      return { type: obj._e2e, iv: obj.iv, ct: obj.ct };
    }
  } catch { /* not JSON */ }
  return null;
}
