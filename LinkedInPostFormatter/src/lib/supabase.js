/**
 * Supabase client, loaded only when configured.
 *
 * The tool works completely without an account, so the SDK is imported
 * dynamically: an unconfigured build never downloads it, and everyone who just
 * wants to format a post pays nothing in bundle size for a feature they are not
 * using.
 *
 * Fill these from Settings → API in the Supabase dashboard. The anon key is
 * designed to be public — row-level security in schema.sql is what actually
 * protects the data, which is why the billing columns are locked by trigger
 * rather than trusted to the client.
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export const isConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientPromise = null;

export function getSupabase() {
  if (!isConfigured()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true },
        })
      )
      .catch(() => null);
  }
  return clientPromise;
}
