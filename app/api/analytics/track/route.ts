import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AnalyticsRepository, hashIp } from '@/lib/repositories/analytics.repository';
import { z } from 'zod';

const trackSchema = z.object({
  profileId: z.string().uuid('Invalid profile ID'),
  type: z.enum(['view', 'click']),
  linkType: z.string().max(50).optional(),
  referralSource: z.string().max(500).optional(),
});

/**
 * POST /api/analytics/track
 * Public endpoint — records profile views and link clicks.
 * Rate limiting should be handled at the edge (Vercel, Cloudflare).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { profileId, type, linkType, referralSource } = parsed.data;

  const supabase = createClient();
  const repo = new AnalyticsRepository(supabase, profileId);

  if (type === 'view') {
    // Hash IP for unique visitor counting — never store raw IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown';
    const ipHash = await hashIp(ip);

    const userAgent = request.headers.get('user-agent') ?? null;

    const result = await repo.recordView({
      referralSource: referralSource ?? null,
      userAgent,
      ipHash,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  }

  if (type === 'click') {
    if (!linkType) {
      return NextResponse.json(
        { error: 'linkType is required for click events' },
        { status: 400 },
      );
    }

    const result = await repo.recordClick(linkType);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  }

  return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
}
