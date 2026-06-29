// Backend abstraction layer - switch between Firebase and Supabase
import type { Backend } from './backends/types';
import { firebaseBackend } from './backends/firebase';
import { supabaseBackend } from './backends/supabase';

const backendType = (import.meta.env.VITE_BACKEND || 'supabase') as 'firebase' | 'supabase';

export const backend: Backend = backendType === 'firebase' ? firebaseBackend : supabaseBackend;

export const getBackendName = () => backendType;

// Export everything from the backend
export const {
  setupRecaptcha,
  signInWithPhone,
  confirmCode,
  logOut,
  onAuthChange,
  createUserProfile,
  updateUserStatus,
  onUserStatusChange,
  sendMessage,
  onIncomingMessages,
  addContact,
  onContactsChange,
  onUserSearch,
} = backend;

// Re-export types
export type { Backend, BackendUser, BackendMessage, BackendContact } from './backends/types';
