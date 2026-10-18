import { NextResponse, type NextRequest } from 'next/server';
import { copySessionResponse, updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;
  const protectedRoute = ['/patients', '/settings', '/analytics', '/search'].some((prefix) => path === prefix || path.startsWith(prefix + '/'));
  const authRoute = ['/login', '/signup', '/reset-password'].includes(path);
  if (protectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', path + request.nextUrl.search);
    return copySessionResponse(response, NextResponse.redirect(url));
  }
  if (authRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/patients';
    url.search = '';
    return copySessionResponse(response, NextResponse.redirect(url));
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
