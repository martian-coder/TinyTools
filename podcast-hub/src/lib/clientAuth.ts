/**
 * Browser-Direct Google Identity Services (GIS) OAuth Module
 * Enables real Google OAuth 2.0 Sign-In directly on GitHub Pages, Vercel, Netlify, or Localhost.
 */

declare global {
  interface Window {
    google?: any;
  }
}

export interface GoogleGisProfile {
  name: string;
  email: string;
  avatar: string;
  handle: string;
  accessToken?: string;
}

let sdkPromise: Promise<void> | null = null;

export function loadGoogleSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity SDK script'));
    document.head.appendChild(script);
  });

  return sdkPromise;
}

function parseJwtToken(token: string): any {
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

export function promptGoogleGisLogin(clientId: string): Promise<GoogleGisProfile> {
  return new Promise(async (resolve, reject) => {
    try {
      await loadGoogleSdk();

      if (!window.google?.accounts) {
        reject(new Error('Google Identity SDK unavailable'));
        return;
      }

      // Try OAuth2 token client popup first (bypasses One Tap origin restrictions)
      if (window.google.accounts.oauth2) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid profile email https://www.googleapis.com/auth/youtube.readonly',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              reject(new Error(tokenResponse.error_description || tokenResponse.error));
              return;
            }

            try {
              // Fetch user profile from Google UserInfo endpoint with access token
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              });
              const payload = await userInfoRes.json();

              const name = payload.name || payload.given_name || 'Google User';
              const email = payload.email || '';
              const avatar = payload.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=11A888&color=fff&size=200&bold=true`;
              const handle = '@' + (email ? email.split('@')[0] : 'google_user');

              const profile: GoogleGisProfile = {
                name,
                email,
                avatar,
                handle,
                accessToken: tokenResponse.access_token,
              };

              localStorage.setItem('user_yt_profile', JSON.stringify(profile));
              window.dispatchEvent(new Event('yt_profile_updated'));

              resolve(profile);
            } catch (fetchErr) {
              reject(fetchErr);
            }
          },
        });

        client.requestAccessToken();
        return;
      }

      // Fallback: One Tap ID token flow
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => {
          if (!response.credential) {
            reject(new Error('No credential returned from Google'));
            return;
          }

          const payload = parseJwtToken(response.credential);
          if (!payload) {
            reject(new Error('Invalid token payload'));
            return;
          }

          const name = payload.name || payload.given_name || 'Google User';
          const email = payload.email || '';
          const avatar = payload.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=11A888&color=fff&size=200&bold=true`;
          const handle = '@' + (email ? email.split('@')[0] : 'google_user');

          const profile: GoogleGisProfile = {
            name,
            email,
            avatar,
            handle,
            accessToken: response.credential,
          };

          localStorage.setItem('user_yt_profile', JSON.stringify(profile));
          window.dispatchEvent(new Event('yt_profile_updated'));

          resolve(profile);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.warn('Google One Tap notice:', notification.getNotDisplayedReason());
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

export async function executeUniversalSignIn(customHandleOrEmail?: string): Promise<GoogleGisProfile> {
  const input = (customHandleOrEmail || '').trim();

  let name = 'Creator Account';
  let handle = '@creator';
  let email = '';
  let avatar = '';

  if (input) {
    if (input.includes('@') && input.includes('.')) {
      email = input;
      const username = input.split('@')[0];
      name = username.charAt(0).toUpperCase() + username.slice(1);
      handle = `@${username}`;
    } else {
      const clean = input.replace(/^@+/, '');
      name = clean.charAt(0).toUpperCase() + clean.slice(1);
      handle = `@${clean}`;
    }
  } else {
    name = 'Guest Creator';
    handle = '@creator';
  }

  avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=11A888&color=fff&size=200&bold=true`;

  const profile: GoogleGisProfile = {
    name,
    email,
    handle,
    avatar,
  };

  localStorage.setItem('user_yt_profile', JSON.stringify(profile));
  window.dispatchEvent(new Event('yt_profile_updated'));

  return profile;
}
