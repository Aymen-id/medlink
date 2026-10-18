import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from '@/lib/config/public';

export async function createClient() {
  const store = await cookies();
  const config = getSupabaseConfig();
  return createServerClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) store.set(name, value, options);
        } catch {
          // Server Components cannot write cookies; the proxy refreshes those sessions.
        }
      },
    },
  });
}
