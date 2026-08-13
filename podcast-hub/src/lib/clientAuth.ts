/**
 * Client-Side Google Identity Services (GIS) OAuth Module
 * Provides real Google OAuth 2.0 Sign-In directly in the browser.
 * Works on any static domain (GitHub Pages, Vercel, netlify, localhost) without requiring a custom backend server.
 */

declare global {
  interface Window {
    google?: any;
  }
}

export interface GoogleUserProfile {
  name: string;
  email: string;
  avatar: string;
  handle: string;
  accessToken?: string;
}

// Load Google Identity Services SDK dynamically
let gisScriptPromise: Promise<void> | null = null;

export function loadGoogleGisScript(): Promise<void> {
  if (gisScriptPromise) return gisScriptPromise;

  gisScriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(new Error('Failed to load Google Identity SDK script'));
    document.head.appendChild(script);
  });

  return gisScriptPromise;
}

/**
 * Decode JWT ID Token payload securely on the client
 */
function parseJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

/**
 * Prompt browser-direct Google One Tap / Sign In dialog
 */
export function signInWithGoogleClient(clientId: string): Promise<GoogleUserProfile> {
  return new Promise(async (resolve, reject) => {
    try {
      await loadGoogleGisScript();

      if (!window.google?.accounts?.id) {
        reject(new Error('Google Identity Services SDK is unavailable'));
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => {
          if (!response.credential) {
            reject(new Error('No credentials returned from Google Sign-In'));
            return;
          }

          const payload = parseJwt(response.credential);
          if (!payload) {
            reject(new Error('Failed to parse Google account token'));
            return;
          }

          const profile: GoogleUserProfile = {
            name: payload.name || payload.given_name || 'Google User',
            email: payload.email || '',
            avatar: payload.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.name || 'User')}&background=11A888&color=fff&size=200&bold=true`,
            handle: '@' + (payload.email ? payload.email.split('@')[0] : 'google_user'),
            accessToken: response.credential,
          };

          // Save to local storage & dispatch event
          localStorage.setItem('user_yt_profile', JSON.stringify(profile));
          window.dispatchEvent(new Event('yt_profile_updated'));

          resolve(profile);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Prompt One Tap dialog or rendered button callback
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // If One-Tap is blocked by browser, render invisible tap button or reject cleanly
          console.warn('Google One Tap not displayed:', notification.getNotDisplayedReason());
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
