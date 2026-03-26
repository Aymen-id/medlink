'use client';

import { useState } from 'react';
import type { Subscription, SubscriptionTier } from '@/types';
import { CurrentPlan } from '@/components/dashboard/CurrentPlan';
import { PricingTable } from '@/components/dashboard/PricingTable';
import { Separator } from '@/components/ui/separator';

type BillingClientProps = {
  subscription: Subscription | null;
};

export function BillingClient({ subscription }: BillingClientProps) {
  const [loading, setLoading] = useState(false);
  const currentTier: SubscriptionTier = subscription?.tier ?? 'free';

  const handleSelectTier = async (
    tier: Exclude<SubscriptionTier, 'free'>,
    interval: 'monthly' | 'annual',
  ) => {
    setLoading(true);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, billingInterval: interval }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <CurrentPlan
        subscription={subscription}
        onManageBilling={handleManageBilling}
        loading={loading}
      />

      <Separator />

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          {currentTier === 'free' ? 'Upgrade your plan' : 'Change plan'}
        </h2>
        <PricingTable
          currentTier={currentTier}
          onSelectTier={handleSelectTier}
          loading={loading}
        />
      </div>
    </div>
  );
}
