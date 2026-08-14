/**
 * Auth module — pure server-side Google OAuth 2.0 redirect flow.
 * No Firebase dependency. No popup. No origin_mismatch.
 *
 * Flow:
 *  1. startGoogleSignIn()          → GET /api/auth/youtube/url → redirect to Google
 *  2. Google                       → redirect to http://localhost:3000/auth/callback?code=...
 *  3. Server /auth/callback        → exchange code, fetch profile, save to localStorage via JS, redirect to /?auth=success
 *  4. resolveGoogleRedirectResult()→ reads profile from localStorage on app boot
 */

export interface UserAuthProfile {
  name: string;
  email: string;
  handle: string;
  avatar: string;
  accessToken?: string;
}

/**
 * Start Google sign-in — fetches the OAuth URL from the server and redirects the browser.
 */
export const startGoogleSignIn = async (): Promise<void> => {
  const origin = window.location.origin;
  // If running on static host like github.io, throw immediately to trigger client authentication without HTTP 404 logs
  if (origin.includes('github.io') || origin.includes('vercel.app')) {
    throw new Error('Static host detected — using browser client authentication');
  }
  const res = await fetch(`/api/auth/youtube/url?origin=${encodeURIComponent(origin)}`);
  const data = await res.json();
  if (data.url) {
    window.location.href = data.url;
  } else {
    throw new Error(data.error || data.message || 'GOOGLE_CLIENT_ID is not configured in .env.');
  }
};

/**
 * Call on app boot — reads the profile from localStorage if a redirect just completed.
 * Returns the profile if present, null otherwise.
 */
export const resolveGoogleRedirectResult = async (): Promise<UserAuthProfile | null> => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('auth') === 'success') {
    let prof: UserAuthProfile | null = null;

    // 1. Try payload param ?p=
    const p = params.get('p');
    if (p) {
      try {
        const decodedStr = atob(decodeURIComponent(p).replace(/-/g, '+').replace(/_/g, '/'));
        prof = JSON.parse(decodedStr);
        if (prof && prof.name) {
          localStorage.setItem('user_yt_profile', JSON.stringify(prof));
        }
      } catch (e) {
        console.warn('Failed to parse profile URL payload:', e);
      }
    }

    // 2. Fallback to localStorage
    if (!prof) {
      try {
        const saved = localStorage.getItem('user_yt_profile');
        if (saved) prof = JSON.parse(saved);
      } catch (e) {}
    }

    // Clean up query parameters from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('auth');
    url.searchParams.delete('p');
    window.history.replaceState({}, '', url.toString());

    if (prof) {
      window.dispatchEvent(new Event('yt_profile_updated'));
      return prof;
    }
  }
  return null;
};

/**
 * Sign out — clears the stored profile.
 */
export const logoutFirebase = async (): Promise<void> => {
  localStorage.removeItem('user_yt_profile');
  window.dispatchEvent(new Event('yt_profile_updated'));
};
