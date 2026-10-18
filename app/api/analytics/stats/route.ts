import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/supabase/context';
import { AnalyticsRepository } from '@/lib/repositories/analytics.repository';
import { SUBSCRIPTION_FEATURES } from '@/lib/constants';
import { getWorkspaceTier } from '@/lib/supabase/entitlements';

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
  const supabase = await createClient();
  const entitlement=await getWorkspaceTier(supabase,context.workspaceId);
  if(entitlement.error || !entitlement.data) return NextResponse.json({ error:'Could not verify analytics access' },{ status:503 });
  const tier=entitlement.data;

  if (!SUBSCRIPTION_FEATURES[tier].analytics) {
    return NextResponse.json(
      { error: 'Upgrade to Pro or Clinic to access analytics' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30', 10) || 30, 1), 365);

  const repo = new AnalyticsRepository(supabase, context.ownerId);

  const metrics=await repo.getDashboard(days);

  if (metrics.error) {
    return NextResponse.json(
      { error: metrics.error },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: metrics.data,
  });
}
