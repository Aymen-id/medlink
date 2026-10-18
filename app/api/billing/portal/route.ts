import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
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

  const supabase = await createClient();
  const account=await supabase.from('billing_accounts').select('stripe_customer_id').eq('id',context.billingAccountId).eq('billing_admin_id',context.userId).maybeSingle();
  if(account.error) return NextResponse.json({ error:'Could not verify billing administration' },{ status:503 });
  if(!account.data) return NextResponse.json({ error:'Only the billing account admin can manage billing' },{ status:403 });

  if (!account.data.stripe_customer_id) {
    return NextResponse.json(
      { error: 'No active subscription found. Please subscribe first.' },
      { status: 400 },
    );
  }

  try {
    const url = await createPortalSession(account.data.stripe_customer_id);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create portal session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
