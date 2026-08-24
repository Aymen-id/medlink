import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/supabase/context';
import { AnalyticsRepository } from '@/lib/repositories/analytics.repository';
import { SUBSCRIPTION_FEATURES } from '@/lib/constants';
import { SubscriptionRepository } from '@/lib/repositories/subscription.repository';

/**
 * GET /api/analytics/stats
 * Protected endpoint — returns analytics for the authenticated owner's profile.
 * Query params: ?days=30 (optional, default 30)
 */
export async function GET(request: NextRequest) {
  const context = await getUserContext();
  if (!context) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Tier check: analytics is a Pro/Clinic feature
  const supabase = createClient();
  const subRepo = new SubscriptionRepository(supabase, context.ownerId);
  const { data: subscription } = await subRepo.findByUserId();
  const tier = subscription?.tier ?? 'free';

  if (!SUBSCRIPTION_FEATURES[tier].analytics) {
    return NextResponse.json(
      { error: 'Upgrade to Pro or Clinic to access analytics' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30', 10) || 30, 1), 365);

  const repo = new AnalyticsRepository(supabase, context.ownerId);

  const [summary, daily, referrers] = await Promise.all([
    repo.getSummary(days),
    repo.getDailyMetrics(days),
    repo.getTopReferrers(10, days),
  ]);

  if (summary.error || daily.error || referrers.error) {
    return NextResponse.json(
      { error: summary.error ?? daily.error ?? referrers.error },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: {
      summary: summary.data,
      daily: daily.data,
      referrers: referrers.data,
    },
  });
}
