import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * Returns a lazily-initialized Stripe client.
 * Throws at call time (not import time) if STRIPE_SECRET_KEY is missing,
 * so the build doesn't fail when the env var isn't set.
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }

  _stripe = new Stripe(key, {
    apiVersion: '2026-02-25.clover',
    typescript: true,
  });

  return _stripe;
}
