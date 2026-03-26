import { getStripe } from './client';
import { STRIPE_PRICE_IDS } from './config';
import type { SubscriptionTier } from '@/types';
import type { BillingInterval } from './config';

/**
 * Creates a Stripe Checkout Session for the given tier and billing interval.
 * Returns the checkout URL that the user should be redirected to.
 */
export async function createCheckoutSession(
  userId: string,
  email: string,
  tier: Exclude<SubscriptionTier, 'free'>,
  billingInterval: BillingInterval,
): Promise<string> {
  const priceId = STRIPE_PRICE_IDS[tier][billingInterval];

  if (!priceId) {
    throw new Error(`No price ID configured for ${tier}/${billingInterval}`);
  }

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      tier,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/settings/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/settings/billing?canceled=true`,
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session');
  }

  return session.url;
}

/**
 * Creates a Stripe Billing Portal session for an existing customer.
 * Returns the portal URL for managing subscriptions.
 */
export async function createPortalSession(stripeCustomerId: string): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/settings/billing`,
  });

  return session.url;
}
