import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/supabase/context';
import { ProfileRepository } from '@/lib/repositories/profile.repository';
import { rateLimit, getClientIp } from '@/lib/utils/rate-limit';

/**
 * GET /api/profile/check-slug?slug=dr-smith — check slug availability.
 */
export async function GET(request: NextRequest) {
  const rl = rateLimit(`slug-check:${getClientIp(request)}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const context = await getUserContext();
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const slug = request.nextUrl.searchParams.get('slug');

  if (!slug || slug.length < 3) {
    return NextResponse.json(
      { error: 'Slug must be at least 3 characters' },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const repo = new ProfileRepository(supabase, context.ownerId);

  const available = await repo.checkSlugAvailability(slug, context.ownerId);

  return NextResponse.json({ available });
}
