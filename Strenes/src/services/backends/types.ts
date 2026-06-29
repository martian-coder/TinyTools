// Shared interface for all backends (Firebase, Supabase, etc.)

export interface BackendUser {
  id: string;
  phone: string;
  displayName: string;
  createdAt: number;
  lastSeen: number;
  online: boolean;
}

export interface BackendMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  delivered: boolean;
}

export interface BackendContact {
  userId: string;
  contactUserId: string;
  phone: string;
  addedAt: number;
  displayName?: string;
  online?: boolean;
}

export interface BackendVerificationResult {
  confirmationResult?: any; // For Firebase phone auth
  sessionToken?: string; // For other providers
}

export interface Backend {
  // Auth
  setupRecaptcha(containerId: string): Promise<any>;
  signInWithPhone(phoneNumber: string, verifier: any): Promise<BackendVerificationResult>;
  confirmCode(result: any, code: string): Promise<any>;
  logOut(): Promise<void>;
  onAuthChange(callback: (user: any) => void): () => void;

  // User Profile
  createUserProfile(userId: string, phoneNumber: string, displayName: string): Promise<void>;
  updateUserStatus(userId: string, online: boolean): Promise<void>;
  onUserStatusChange(userId: string, callback: (data: BackendUser) => void): () => void;

  // Messaging
  sendMessage(fromUserId: string, toUserId: string, text: string): Promise<string>;
  onIncomingMessages(userId: string, callback: (message: BackendMessage) => void): () => void;

  // Contacts
  addContact(userId: string, contactUserId: string, contactPhone: string): Promise<void>;
  onContactsChange(userId: string, callback: (contacts: Record<string, BackendContact>) => void): () => void;
  onUserSearch(phoneNumber: string, callback: (user: BackendUser | null) => void): () => void;
}
