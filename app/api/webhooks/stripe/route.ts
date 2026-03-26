import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubscriptionRepository } from '@/lib/repositories/subscription.repository';
import type { SubscriptionTier } from '@/types';
import type Stripe from 'stripe';

/**
 * POST /api/webhooks/stripe — handle Stripe webhook events.
 *
 * Events handled:
 * - checkout.session.completed → create/update subscription
 * - customer.subscription.updated → sync tier/status changes
 * - customer.subscription.deleted → downgrade to free
 * - invoice.payment_failed → mark subscription as past_due
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? '',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const tier = (session.metadata?.tier ?? 'pro') as SubscriptionTier;

        if (!userId) break;

        // Retrieve the subscription for period data
        let currentPeriodEnd = '';
        if (session.subscription) {
          const sub = await getStripe().subscriptions.retrieve(
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id,
          );
          // In newer Stripe API, current_period_end is on items
          const periodEnd = (sub as unknown as Record<string, unknown>).current_period_end
            ?? sub.items?.data[0]?.current_period_end;
          if (typeof periodEnd === 'number') {
            currentPeriodEnd = new Date(periodEnd * 1000).toISOString();
          }
        }

        const repo = new SubscriptionRepository(supabase, userId);
        await repo.createOrUpdateFromStripe({
          stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? '',
          stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? '',
          tier,
          status: 'active',
          currentPeriodEnd,
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;

        // Look up the user by stripe_customer_id
        const { data: subRow } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (!subRow) break;

        const repo = new SubscriptionRepository(supabase, subRow.user_id);
        // Map Stripe price to tier
        const priceId = subscription.items.data[0]?.price.id ?? '';
        const tier = mapPriceToTier(priceId);

        // Extract period end from subscription or items
        const periodEnd = (subscription as unknown as Record<string, unknown>).current_period_end
          ?? subscription.items?.data[0]?.current_period_end;
        const periodEndIso = typeof periodEnd === 'number'
          ? new Date(periodEnd * 1000).toISOString()
          : '';

        await repo.createOrUpdateFromStripe({
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          tier,
          status: subscription.status,
          currentPeriodEnd: periodEndIso,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;

        const { data: subRow } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (!subRow) break;

        const repo = new SubscriptionRepository(supabase, subRow.user_id);
        await repo.downgradeToFree();
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id ?? '';

        if (!customerId) break;

        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_customer_id', customerId);
        break;
      }

      default:
        // Unhandled event type — acknowledged but no action required
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook handler error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/**
 * Maps a Stripe price ID to a subscription tier.
 * Falls back to 'pro' if the price ID is not recognized.
 */
function mapPriceToTier(priceId: string): SubscriptionTier {
  const proMonthly = process.env.STRIPE_PRICE_PRO_MONTHLY ?? '';
  const proAnnual = process.env.STRIPE_PRICE_PRO_ANNUAL ?? '';
  const clinicMonthly = process.env.STRIPE_PRICE_CLINIC_MONTHLY ?? '';
  const clinicAnnual = process.env.STRIPE_PRICE_CLINIC_ANNUAL ?? '';

  if (priceId === clinicMonthly || priceId === clinicAnnual) return 'clinic';
  if (priceId === proMonthly || priceId === proAnnual) return 'pro';
  return 'pro'; // safe fallback
}
