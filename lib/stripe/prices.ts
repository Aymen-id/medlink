import 'server-only';
import { getServerConfig } from '@/lib/config/server';

export function getStripePrices() {
  const env = getServerConfig('billing');
  return {
    pro: { monthly: env.STRIPE_PRICE_PRO_MONTHLY, annual: env.STRIPE_PRICE_PRO_ANNUAL },
    clinic: { monthly: env.STRIPE_PRICE_CLINIC_MONTHLY, annual: env.STRIPE_PRICE_CLINIC_ANNUAL },
  };
}
