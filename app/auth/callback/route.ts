import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAppOrigin } from '@/lib/config/public';
import { safeRedirectPath } from '@/lib/utils/redirect';

const otpType = z.enum(['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']);
const token = z.string().min(1).max(8192);

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const type = otpType.safeParse(query.get('type'));
  const recovery = type.success && type.data === 'recovery';
  const destination = recovery ? '/reset-password/update' : type.success && type.data==='invite'
    ? '/reset-password/update?next=%2Fsettings%2Fteam' : safeRedirectPath(query.get('next'));
  const failedDestination = recovery || destination === '/reset-password/update'
    ? '/reset-password/update?error=expired' : '/login?error=auth_callback';
  let accepted = false;
  try {
    const code = token.safeParse(query.get('code'));
    const hash = token.safeParse(query.get('token_hash'));
    if (code.success && !hash.success) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code.data);
      accepted = !error;
    } else if (hash.success && type.success && !code.success) {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({ token_hash: hash.data, type: type.data });
      accepted = !error;
    }
  } catch {
    accepted = false;
  }
  const response = NextResponse.redirect(new URL(accepted ? destination : failedDestination, getAppOrigin()));
  response.headers.set('cache-control', 'private, no-store');
  response.headers.set('referrer-policy', 'no-referrer');
  return response;
}
