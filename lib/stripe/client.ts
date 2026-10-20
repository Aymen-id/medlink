import Stripe from 'stripe';
import { getServerConfig } from '@/lib/config/server';

let _stripe: Stripe | null = null;

/**
 * Returns a lazily-initialized Stripe client.
 * Throws at call time (not import time) if STRIPE_SECRET_KEY is missing,
 * so the build doesn't fail when the env var isn't set.
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const key = getServerConfig('billing').STRIPE_SECRET_KEY;

  _stripe = new Stripe(key, {
    apiVersion: '2026-02-25.clover',
    typescript: true,
    timeout:20_000,
    maxNetworkRetries:1,
  });

  return _stripe;
}
