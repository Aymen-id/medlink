import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
import { startBillingCheckout } from '@/lib/stripe/reconciliation';
import { createAdminClient } from '@/lib/supabase/admin';
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

  const body = await request.json().catch(()=>null);
  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'User email not found' }, { status: 400 });
  }

  const account=await supabase.from('billing_accounts').select('id').eq('id',context.billingAccountId).eq('billing_admin_id',context.userId).maybeSingle();
  if(account.error) return NextResponse.json({ error:'Could not verify billing administration' },{ status:503 });
  if(!account.data) return NextResponse.json({ error:'Only the billing account admin can change the subscription' },{ status:403 });

  try {
    const url = await startBillingCheckout(
      createAdminClient(),context.billingAccountId,
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
