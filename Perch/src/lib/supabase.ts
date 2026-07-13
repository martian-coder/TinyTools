import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const backendConfigured = () =>
  !!SUPABASE_URL && !!SUPABASE_ANON_KEY && !SUPABASE_URL.includes('your-project');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
