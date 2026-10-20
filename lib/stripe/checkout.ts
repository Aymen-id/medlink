import { getStripe } from './client';
import { getStripePrices } from './prices';
import { getAppOrigin } from '@/lib/config/public';
import { getServerConfig } from '@/lib/config/server';
import type { SubscriptionTier } from '@/types';
import type { BillingInterval } from './config';

/**
 * Creates a Stripe Checkout Session for the given tier and billing interval.
 * Returns the checkout URL that the user should be redirected to.
 */
export async function createCheckoutSession(
  billingAccountId: string,
  customerId: string,
  tier: Exclude<SubscriptionTier, 'free'>,
  billingInterval: BillingInterval,
  attemptId:string,
  verifyBeforeReturn?:()=>Promise<void>,
): Promise<string> {
  const priceId = getStripePrices()[tier][billingInterval];

  if (!priceId) {
    throw new Error(`No price ID configured for ${tier}/${billingInterval}`);
  }

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id:billingAccountId,
    subscription_data:{ metadata:{ billingAccountId } },
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      billingAccountId,
      priceId,
      tier,
    },
    success_url: `${getAppOrigin()}/settings/billing?success=true`,
    cancel_url: `${getAppOrigin()}/settings/billing?canceled=true`,
    expires_at:Math.floor(Date.now()/1000)+30*60,
  },{ idempotencyKey:`medilink-checkout:${billingAccountId}:${attemptId}` });

  if (!session.url) {
    throw new Error('Failed to create checkout session');
  }
  try { await verifyBeforeReturn?.(); }
  catch(error) {
    await getStripe().checkout.sessions.expire(session.id).catch(()=>undefined);
    throw error;
  }

  return session.url;
}

/**
 * Creates a Stripe Billing Portal session for an existing customer.
 * Returns the portal URL for managing subscriptions.
 */
export async function createPortalSession(stripeCustomerId: string,change?:{ subscriptionId:string;itemId:string;priceId:string }): Promise<string> {
  const configuration=getServerConfig('billing').STRIPE_PORTAL_CONFIGURATION_ID;
  const session = await getStripe().billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${getAppOrigin()}/settings/billing`,
    ...(configuration ? { configuration }:{}),
    ...(change ? { flow_data:{ type:'subscription_update_confirm' as const,subscription_update_confirm:{ subscription:change.subscriptionId,items:[{ id:change.itemId,price:change.priceId,quantity:1 }] } } }:{}),
  });

  return session.url;
}
