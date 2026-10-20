'use client';

import { useState } from 'react';
import type { SubscriptionTier } from '@/types';
import { TIER_PRICING } from '@/lib/constants';
import { BillingIntervalSelector } from '@/components/pricing/BillingIntervalSelector';
import { CurrentPlanIndicator, PricingAction, PricingCards, type PricingPlanPresentation } from '@/components/pricing/PricingCards';

type PricingTableProps = {
  currentTier: SubscriptionTier;
  onSelectTier: (tier: Exclude<SubscriptionTier, 'free'>, interval: 'monthly' | 'annual') => void;
  loading?: boolean;
  currentInterval?: 'monthly' | 'annual';
};

const FEATURES = [
  { name: 'Patient files', free: 'Up to 10', pro: 'Unlimited', clinic: 'Unlimited' },
  { name: 'Full-text search', free: true, pro: true, clinic: true },
  { name: 'Folders & tags', free: true, pro: true, clinic: true },
  { name: 'Public profile', free: true, pro: true, clinic: true },
  { name: 'Profile analytics', free: false, pro: true, clinic: true },
  { name: 'Appointment notes', free: false, pro: true, clinic: true },
  { name: 'ZIP export (up to 100 MiB)', free: true, pro: true, clinic: true },
  { name: 'Physician workspaces', free: '1', pro: '1', clinic: 'Up to 8' },
  { name: 'Priority support', free: false, pro: false, clinic: true },
];

export function PricingTable({ currentTier, onSelectTier, loading, currentInterval = 'monthly' }: PricingTableProps) {
  const [interval, setInterval] = useState<'monthly' | 'annual'>(currentInterval);

  const plans: PricingPlanPresentation[] = (['free', 'pro', 'clinic'] as const).map(tier => {
    const current = currentTier === tier;
    const matchesInterval = currentInterval === interval;
    const name = tier === 'free' ? 'Free' : tier === 'pro' ? 'Pro' : 'Clinic';
    return {
      id: tier,
      name,
      description: tier === 'free' ? 'Get started' : tier === 'pro' ? 'For growing practices' : 'For multi-provider clinics',
      price: tier === 'free' ? 0 : interval === 'monthly' ? TIER_PRICING[tier].monthly : Math.round(TIER_PRICING[tier].annual / 12),
      billingNote: tier !== 'free' && interval === 'annual' ? `Billed $${TIER_PRICING[tier].annual}/year` : undefined,
      current,
      highlighted: tier === 'pro',
      badge: tier === 'pro' ? 'Most Popular' : undefined,
      features: FEATURES.map(feature => ({
        label: typeof feature[tier] === 'string' ? `${feature.name}: ${feature[tier]}` : feature.name,
        included: feature[tier] !== false,
      })),
      action: current && (tier === 'free' || matchesInterval)
        ? <CurrentPlanIndicator />
        : tier === 'free'
          ? undefined
          : (
            <PricingAction emphasis={tier === 'pro'} disabled={loading} onClick={() => onSelectTier(tier, interval)}>
              {current ? `Change ${name} billing` : currentTier === 'free' ? `Upgrade to ${name}` : `Switch to ${name}`}
            </PricingAction>
          ),
    };
  });

  return (
    <div className="min-w-0 space-y-6">
      <BillingIntervalSelector value={interval} onChange={setInterval} />
      <PricingCards plans={plans} idPrefix="billing-plan" />
    </div>
  );
}
