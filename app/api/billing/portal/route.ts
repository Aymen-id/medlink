import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
import { SubscriptionRepository } from '@/lib/repositories/subscription.repository';
import { createPortalSession } from '@/lib/stripe/checkout';
import { rateLimit, getClientIp } from '@/lib/utils/rate-limit';

/**
 * POST /api/billing/portal — create a Stripe Billing Portal session.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(`portal:${getClientIp(request)}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const context = await getUserContext();
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  const repo = new SubscriptionRepository(supabase, context.ownerId);
  const { data: subscription } = await repo.findByUserId();

  if (!subscription?.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No active subscription found. Please subscribe first.' },
      { status: 400 },
    );
  }

  try {
    const url = await createPortalSession(subscription.stripeCustomerId);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create portal session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
