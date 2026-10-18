import { parseAppOrigin, parseSupabaseConfig } from './environment';

export function getSupabaseConfig() {
  // Literal reads let Next.js inline only these public values into browser code.
  return parseSupabaseConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function getAppOrigin() {
  return parseAppOrigin(process.env.NEXT_PUBLIC_APP_URL);
}
