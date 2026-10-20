import type { SubscriptionTier } from '@/types';

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
