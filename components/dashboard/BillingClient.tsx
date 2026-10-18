'use client';

import { useState } from 'react';
import type { Subscription, SubscriptionTier } from '@/types';
import { CurrentPlan } from '@/components/dashboard/CurrentPlan';
import { PricingTable } from '@/components/dashboard/PricingTable';
import { Separator } from '@/components/ui/separator';
import { z } from 'zod';

type BillingClientProps = {
  subscription: Subscription | null;
  effectiveTier?:SubscriptionTier;
};

export function BillingClient({ subscription,effectiveTier }: BillingClientProps) {
  const [loading, setLoading] = useState(false);
  const [error,setError]=useState<string | null>(null);
  const currentTier: SubscriptionTier = effectiveTier ?? (subscription && ['active','trialing'].includes(subscription.status) ? subscription.tier:'free');
  async function navigate(response:Response) {
    const result=z.object({ url:z.url().optional(),error:z.string().optional() }).safeParse(await response.json());
    if(!response.ok || !result.success || !result.data.url) throw new Error(result.success ? result.data.error ?? 'Billing request failed. Please retry.':'Invalid billing response. Please retry.');
    window.location.href=result.data.url;
  }

  const handleSelectTier = async (
    tier: Exclude<SubscriptionTier, 'free'>,
    interval: 'monthly' | 'annual',
  ) => {
    setLoading(true);setError(null);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, billingInterval: interval }),
      });

      await navigate(response);
    } catch(cause) { setError(cause instanceof Error ? cause.message:'Billing request failed. Please retry.'); } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setLoading(true);setError(null);
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
      });

      await navigate(response);
    } catch(cause) { setError(cause instanceof Error ? cause.message:'Billing request failed. Please retry.'); } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <CurrentPlan
        subscription={subscription}
        effectiveTier={currentTier}
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
          currentInterval={subscription?.billingInterval ?? 'monthly'}
          onSelectTier={handleSelectTier}
          loading={loading}
        />
      </div>
    </div>
  );
}
