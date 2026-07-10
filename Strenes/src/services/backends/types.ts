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
  confirmationResult?: any; // Backend-specific state carried from signIn → confirm
  sessionToken?: string; // For other providers
}

/** Normalized result of a successful OTP confirmation, same shape on every backend. */
export interface BackendAuthUser {
  userId: string;
  phone: string;
}

export interface Backend {
  // Auth
  setupRecaptcha(containerId: string): Promise<any>;
  signInWithPhone(phoneNumber: string, verifier: any): Promise<BackendVerificationResult>;
  confirmCode(result: BackendVerificationResult, code: string): Promise<BackendAuthUser>;
  /**
   * Fallback sign-up when no SMS provider is configured: creates a real
   * backend session (anonymous auth) and claims the phone number as the
   * user's identity WITHOUT verifying it. Fine for evaluation builds;
   * production should use verified OTP.
   */
  signInWithoutSms?(phoneNumber: string): Promise<BackendAuthUser>;
  logOut(): Promise<void>;
  onAuthChange(callback: (user: any) => void): () => void;

  // User Profile
  createUserProfile(userId: string, phoneNumber: string, displayName: string): Promise<void>;
  getUserProfile(userId: string): Promise<BackendUser | null>;
  updateUserStatus(userId: string, online: boolean): Promise<void>;
  onUserStatusChange(userId: string, callback: (data: BackendUser) => void): () => void;

  // Messaging
  sendMessage(fromUserId: string, toUserId: string, text: string): Promise<string>;
  /**
   * Subscribe to messages addressed to userId. The backend must not discard a
   * message until the (possibly async) callback resolves — the callback storing
   * the message locally is the only durable copy in this relay architecture.
   */
  onIncomingMessages(userId: string, callback: (message: BackendMessage) => void | Promise<void>): () => void;

  // Contacts
  addContact(userId: string, contactUserId: string, contactPhone: string): Promise<void>;
  onContactsChange(userId: string, callback: (contacts: Record<string, BackendContact>) => void): () => void;
  onUserSearch(phoneNumber: string, callback: (user: BackendUser | null, error?: string) => void): () => void;
}
