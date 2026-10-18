import { NextRequest,NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerConfig } from '@/lib/config/server';
import { reconcileStripeEvent } from '@/lib/stripe/reconciliation';
import type Stripe from 'stripe';

export async function POST(request:NextRequest) {
  const signature=request.headers.get('stripe-signature');
  if(!signature) return NextResponse.json({ error:'Missing stripe-signature header' },{ status:400 });
  let event:Stripe.Event;
  try { event=getStripe().webhooks.constructEvent(await request.text(),signature,getServerConfig('billing').STRIPE_WEBHOOK_SECRET); }
  catch { return NextResponse.json({ error:'Webhook signature verification failed' },{ status:400 }); }
  try { await reconcileStripeEvent(createAdminClient(),event); }
  catch { return NextResponse.json({ error:'Billing reconciliation failed; retry this delivery' },{ status:503 }); }
  return NextResponse.json({ received:true });
}
