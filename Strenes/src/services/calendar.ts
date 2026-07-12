/**
 * calendar — Google Calendar integration for Commander meeting scheduling.
 *
 * Two paths, best available wins:
 *  1. Google Calendar API (OAuth via Google Identity Services) — only when a
 *     client ID is configured (VITE_GOOGLE_CLIENT_ID). Creates the event
 *     directly with a Google Meet link attached.
 *  2. Template URL — zero-config fallback that always works: opens Google
 *     Calendar (app or web) with the event prefilled; the user taps Save.
 */

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export interface MeetingSpec {
  title: string;
  startTs: number;   // epoch ms
  endTs: number;     // epoch ms
  details?: string;
}

export type MeetingResult =
  | { mode: 'api'; htmlLink?: string; meetLink?: string }
  | { mode: 'url'; url: string };

/** YYYYMMDDTHHMMSSZ — the compact UTC format the template URL expects. */
function gcalStamp(ts: number): string {
  return new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildCalendarUrl(spec: MeetingSpec): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: spec.title,
    dates: `${gcalStamp(spec.startTs)}/${gcalStamp(spec.endTs)}`,
    details: spec.details ?? 'Scheduled via Strenes Commander',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ── OAuth path (Google Identity Services) ───────────────────────────────────

export function calendarApiConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID;
}

let accessToken: string | null = null;
let gisLoaded: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (gisLoaded) return gisLoaded;
  gisLoaded = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
  return gisLoaded;
}

/** Interactive OAuth token request. Resolves null if the user closes the popup. */
async function getAccessToken(): Promise<string | null> {
  if (accessToken) return accessToken;
  if (!GOOGLE_CLIENT_ID) return null;
  try {
    await loadGis();
    return await new Promise<string | null>((resolve) => {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: CAL_SCOPE,
        callback: (resp: { access_token?: string }) => {
          accessToken = resp.access_token ?? null;
          resolve(accessToken);
        },
        error_callback: () => resolve(null),
      });
      client.requestAccessToken();
    });
  } catch {
    return null;
  }
}

async function createViaApi(spec: MeetingSpec): Promise<MeetingResult | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          summary: spec.title,
          description: spec.details ?? 'Scheduled via Strenes Commander',
          start: { dateTime: new Date(spec.startTs).toISOString() },
          end: { dateTime: new Date(spec.endTs).toISOString() },
          conferenceData: {
            createRequest: {
              requestId: `strenes-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        }),
      },
    );
    if (res.status === 401) { accessToken = null; return null; }
    if (!res.ok) return null;
    const data = await res.json() as {
      htmlLink?: string;
      conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
    };
    const meetLink = data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri;
    return { mode: 'api', htmlLink: data.htmlLink, meetLink };
  } catch {
    return null;
  }
}

/**
 * Create a meeting the best way available. Never throws — the template URL
 * fallback always succeeds.
 */
export async function createMeeting(spec: MeetingSpec): Promise<MeetingResult> {
  if (calendarApiConfigured()) {
    const viaApi = await createViaApi(spec);
    if (viaApi) return viaApi;
  }
  return { mode: 'url', url: buildCalendarUrl(spec) };
}
