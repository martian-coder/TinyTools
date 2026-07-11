/**
 * ai-proxy — server-side Gemini proxy so the API key NEVER ships to clients.
 *
 * The app calls this function instead of Gemini directly whenever the user
 * hasn't pasted their own key in Settings. The key lives in the function's
 * environment (Supabase secret GEMINI_API_KEY), so it cannot be extracted
 * from the APK or the web bundle.
 *
 * Deploy:   supabase functions deploy ai-proxy
 * Secret:   supabase secrets set GEMINI_API_KEY=<your key>
 * (Both also possible from the Supabase dashboard — see SUPABASE_SETUP.md.)
 */

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

// Best-effort per-caller rate limit (per warm instance). Callers are keyed by
// their Authorization header (user JWT or anon key) + IP.
const RATE_LIMIT = 30; // requests per minute
const buckets = new Map<string, { n: number; reset: number }>();

function rateLimited(caller: string): boolean {
  const now = Date.now();
  const b = buckets.get(caller);
  if (!b || now > b.reset) {
    buckets.set(caller, { n: 1, reset: now + 60_000 });
    return false;
  }
  b.n += 1;
  return b.n > RATE_LIMIT;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY secret is not set' }, 500);

  const caller =
    (req.headers.get('authorization') ?? '') +
    (req.headers.get('x-forwarded-for') ?? '');
  if (rateLimited(caller)) return json({ error: 'rate limited — try again in a minute' }, 429);

  let body: { system?: unknown; user?: unknown; maxTokens?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const system = typeof body.system === 'string' ? body.system : '';
  const user = typeof body.user === 'string' ? body.user : '';
  if (!system || !user) return json({ error: 'system and user are required strings' }, 400);
  if (system.length + user.length > 16_000) return json({ error: 'input too large' }, 400);
  const maxTokens = Math.min(typeof body.maxTokens === 'number' ? body.maxTokens : 300, 512);

  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0, maxOutputTokens: maxTokens },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return json({ error: `upstream ${res.status}`, detail: detail.slice(0, 300) }, 502);
    }
    const data = await res.json();
    const text: string | null =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('') ?? null;
    return json({ text });
  } catch (err) {
    return json({ error: `proxy failure: ${err instanceof Error ? err.message : 'unknown'}` }, 502);
  }
});
