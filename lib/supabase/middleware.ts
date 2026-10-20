import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from '@/lib/config/public';

/** Keep every cookie chunk, including removals, through response recreation. */
export async function updateSession(request: NextRequest) {
  const config = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const pending = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const supabase = createServerClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        for (const cookie of cookies) {
          request.cookies.set(cookie.name, cookie.value);
          pending.set(cookie.name, cookie);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of pending.values()) response.cookies.set(name, value, options);
      },
    },
  });
  // Validate with Auth rather than trusting cookie contents.
  const { data: { user } } = await supabase.auth.getUser();
  response.headers.set('cache-control', 'private, no-store');
  response.headers.set('pragma', 'no-cache');
  response.headers.set('expires', '0');
  return { response, user };
}

export function copySessionResponse(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  for (const name of ['cache-control', 'pragma', 'expires']) {
    const value = source.headers.get(name);
    if (value) target.headers.set(name, value);
  }
  return target;
}
