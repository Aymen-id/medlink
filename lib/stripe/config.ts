import type { SubscriptionTier } from '@/types';

/**
 * Stripe Price IDs — set these from your Stripe Dashboard.
 * These should be configured as env vars in production; here we define the mapping shape.
 */
export const STRIPE_PRICE_IDS: Record<
  Exclude<SubscriptionTier, 'free'>,
  { monthly: string; annual: string }
> = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? '',
  },
  clinic: {
    monthly: process.env.STRIPE_PRICE_CLINIC_MONTHLY ?? '',
    annual: process.env.STRIPE_PRICE_CLINIC_ANNUAL ?? '',
  },
};

export type BillingInterval = 'monthly' | 'annual';

export const TIER_DISPLAY: Record<SubscriptionTier, { name: string; description: string }> = {
  free: {
    name: 'Free',
    description: 'Get started with basic features',
  },
  pro: {
    name: 'Pro',
    description: 'Unlimited storage, analytics, and advanced search',
  },
  clinic: {
    name: 'Clinic',
    description: 'Team collaboration with up to 8 providers',
  },
};
