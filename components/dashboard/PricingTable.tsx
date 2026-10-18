'use client';

import type { SubscriptionTier } from '@/types';
import { TIER_PRICING } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { useState } from 'react';

type PricingTableProps = {
  currentTier: SubscriptionTier;
  onSelectTier: (tier: Exclude<SubscriptionTier, 'free'>, interval: 'monthly' | 'annual') => void;
  loading?: boolean;
  currentInterval?:'monthly' | 'annual';
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

export function PricingTable({ currentTier, onSelectTier, loading,currentInterval='monthly' }: PricingTableProps) {
  const [interval, setInterval] = useState<'monthly' | 'annual'>(currentInterval);

  return (
    <div className="space-y-6">
      {/* Billing interval toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setInterval('monthly')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            interval === 'monthly'
              ? 'bg-blue-800 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval('annual')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            interval === 'annual'
              ? 'bg-blue-800 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Annual
          <Badge className="ml-2 bg-green-100 text-green-700 text-xs">-20%</Badge>
        </button>
      </div>

      {/* Tier cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        {/* Free */}
        <Card className={currentTier === 'free' ? 'ring-2 ring-blue-800' : ''}>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <CardDescription>Get started</CardDescription>
            <div className="mt-2">
              <span className="text-3xl font-bold">$0</span>
              <span className="text-gray-500">/mo</span>
            </div>
          </CardHeader>
          <CardContent>
            {currentTier === 'free' ? (
              <Badge className="w-full justify-center py-2 bg-blue-50 text-blue-800">
                Current Plan
              </Badge>
            ) : (
              <div className="h-9" />
            )}
            <ul className="mt-4 space-y-2">
              {FEATURES.map((f) => (
                <FeatureRow key={f.name} name={f.name} value={f.free} />
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Pro */}
        <Card className={`${currentTier === 'pro' ? 'ring-2 ring-blue-800' : ''} relative`}>
          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-800 text-white">
            Most Popular
          </Badge>
          <CardHeader>
            <CardTitle>Pro</CardTitle>
            <CardDescription>For growing practices</CardDescription>
            <div className="mt-2">
              <span className="text-3xl font-bold">
                ${interval === 'monthly' ? TIER_PRICING.pro.monthly : Math.round(TIER_PRICING.pro.annual / 12)}
              </span>
              <span className="text-gray-500">/mo</span>
              {interval === 'annual' && (
                <p className="text-xs text-gray-400 mt-1">
                  Billed ${TIER_PRICING.pro.annual}/year
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {currentTier === 'pro' && currentInterval===interval ? (
              <Badge className="w-full justify-center py-2 bg-blue-50 text-blue-800">
                Current Plan
              </Badge>
            ) : (
              <Button
                onClick={() => onSelectTier('pro', interval)}
                disabled={loading}
                className="w-full bg-blue-800 hover:bg-blue-700"
              >
                {currentTier === 'pro' ? 'Change Pro billing':currentTier === 'free' ? 'Upgrade to Pro' : 'Switch to Pro'}
              </Button>
            )}
            <ul className="mt-4 space-y-2">
              {FEATURES.map((f) => (
                <FeatureRow key={f.name} name={f.name} value={f.pro} />
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Clinic */}
        <Card className={currentTier === 'clinic' ? 'ring-2 ring-blue-800' : ''}>
          <CardHeader>
            <CardTitle>Clinic</CardTitle>
            <CardDescription>For multi-provider clinics</CardDescription>
            <div className="mt-2">
              <span className="text-3xl font-bold">
                ${interval === 'monthly' ? TIER_PRICING.clinic.monthly : Math.round(TIER_PRICING.clinic.annual / 12)}
              </span>
              <span className="text-gray-500">/mo</span>
              {interval === 'annual' && (
                <p className="text-xs text-gray-400 mt-1">
                  Billed ${TIER_PRICING.clinic.annual}/year
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {currentTier === 'clinic' && currentInterval===interval ? (
              <Badge className="w-full justify-center py-2 bg-blue-50 text-blue-800">
                Current Plan
              </Badge>
            ) : (
              <Button
                onClick={() => onSelectTier('clinic', interval)}
                disabled={loading}
                className="w-full bg-blue-800 hover:bg-blue-700"
              >
                {currentTier === 'clinic' ? 'Change Clinic billing':currentTier === 'free' ? 'Upgrade to Clinic' : 'Switch to Clinic'}
              </Button>
            )}
            <ul className="mt-4 space-y-2">
              {FEATURES.map((f) => (
                <FeatureRow key={f.name} name={f.name} value={f.clinic} />
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FeatureRow({ name, value }: { name: string; value: boolean | string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {value === false ? (
        <X className="h-4 w-4 text-gray-300 shrink-0" />
      ) : (
        <Check className="h-4 w-4 text-green-600 shrink-0" />
      )}
      <span className={value === false ? 'text-gray-400' : 'text-gray-700'}>
        {typeof value === 'string' ? `${name}: ${value}` : name}
      </span>
    </li>
  );
}
