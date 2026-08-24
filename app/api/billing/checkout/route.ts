import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
import { SubscriptionRepository } from '@/lib/repositories/subscription.repository';
import { createCheckoutSession } from '@/lib/stripe/checkout';
import { rateLimit, getClientIp } from '@/lib/utils/rate-limit';
import { z } from 'zod';

const checkoutSchema = z.object({
  tier: z.enum(['pro', 'clinic']),
  billingInterval: z.enum(['monthly', 'annual']),
});

/**
 * POST /api/billing/checkout — create a Stripe Checkout session.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(`checkout:${getClientIp(request)}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const context = await getUserContext();
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'User email not found' }, { status: 400 });
  }

  // Check if user already has an active subscription for this tier
  const subscriptionRepo = new SubscriptionRepository(supabase, context.ownerId);
  const currentTier = await subscriptionRepo.getTier();

  if (currentTier === parsed.data.tier) {
    return NextResponse.json(
      { error: 'You are already subscribed to this tier' },
      { status: 409 },
    );
  }

  try {
    const url = await createCheckoutSession(
      context.ownerId,
      user.email,
      parsed.data.tier,
      parsed.data.billingInterval,
    );

    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
