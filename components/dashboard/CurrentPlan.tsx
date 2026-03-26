'use client';

import type { Subscription, SubscriptionTier } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TIER_DISPLAY } from '@/lib/stripe/config';
import { CreditCard, ExternalLink } from 'lucide-react';

type CurrentPlanProps = {
  subscription: Subscription | null;
  onManageBilling: () => void;
  loading?: boolean;
};

function getTierBadgeColor(tier: SubscriptionTier): string {
  switch (tier) {
    case 'pro': return 'bg-blue-100 text-blue-800';
    case 'clinic': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export function CurrentPlan({ subscription, onManageBilling, loading }: CurrentPlanProps) {
  const tier = subscription?.tier ?? 'free';
  const display = TIER_DISPLAY[tier];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <Badge className={getTierBadgeColor(tier)}>{display.name}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">{display.description}</p>

        {subscription?.currentPeriodEnd && (
          <p className="text-xs text-gray-400">
            Current period ends:{' '}
            {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        )}

        {subscription?.status === 'past_due' && (
          <Badge className="bg-red-100 text-red-800">Payment Past Due</Badge>
        )}

        {tier !== 'free' && subscription?.stripeCustomerId && (
          <Button
            variant="outline"
            onClick={onManageBilling}
            disabled={loading}
            className="mt-2"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Manage Billing
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
