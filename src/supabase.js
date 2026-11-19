import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// The Supabase client is vendored (vendor/supabase.js) so the app loads offline and never depends on a CDN.
const lib = globalThis.supabase;
export const hasCloud = !!lib?.createClient;

export const sb = hasCloud
  ? lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
