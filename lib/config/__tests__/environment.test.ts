import { describe, expect, it } from 'vitest';
import { parseAppOrigin, parseServerConfig, parseSupabaseConfig } from '../environment';

describe('environment validation', () => {
  it('fails with setting names but no secret values when required configuration is absent', () => {
    expect(() => parseSupabaseConfig({})).toThrow('NEXT_PUBLIC_SUPABASE_URL');
    expect(() => parseServerConfig({}, 'billing')).toThrow('STRIPE_SECRET_KEY');
    expect(() => parseServerConfig({ STRIPE_SECRET_KEY: 'do-not-print-me' }, 'billing')).not.toThrow('do-not-print-me');
  });

  it('requires a configured HTTP origin without credentials, paths or query parameters', () => {
    expect(parseAppOrigin('https://medilink.example/')).toBe('https://medilink.example');
    expect(parseAppOrigin('http://localhost:3000')).toBe('http://localhost:3000');
    for (const value of [undefined, 'javascript:alert(1)', 'https://user:pass@example.com', 'https://example.com/other', 'https://example.com?next=evil']) {
      expect(() => parseAppOrigin(value)).toThrow('NEXT_PUBLIC_APP_URL');
    }
  });

  it('requires all four billing prices and accepts documented canonical names', () => {
    const config = parseServerConfig({
      STRIPE_SECRET_KEY: 'sk_test_example', STRIPE_WEBHOOK_SECRET: 'whsec_example',
      STRIPE_PRICE_PRO_MONTHLY: 'price_pro_month', STRIPE_PRICE_PRO_ANNUAL: 'price_pro_year',
      STRIPE_PRICE_CLINIC_MONTHLY: 'price_clinic_month', STRIPE_PRICE_CLINIC_ANNUAL: 'price_clinic_year',
    }, 'billing');
    expect(config.STRIPE_PRICE_PRO_MONTHLY).toBe('price_pro_month');
  });

  it('requires an explicit strong analytics salt', () => {
    expect(() => parseServerConfig({}, 'analytics')).toThrow('IP_HASH_SALT');
    expect(() => parseServerConfig({ IP_HASH_SALT: 'too-short' }, 'analytics')).toThrow('IP_HASH_SALT');
  });

  it('accepts legacy Stripe price aliases but rejects contradictory mappings', () => {
    const source = {
      STRIPE_SECRET_KEY: 'sk_test_example', STRIPE_WEBHOOK_SECRET: 'whsec_example',
      NEXT_PUBLIC_STRIPE_PRO_PRICE_ID: 'price_pro_month', NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID: 'price_pro_year',
      NEXT_PUBLIC_STRIPE_CLINIC_PRICE_ID: 'price_clinic_month', NEXT_PUBLIC_STRIPE_CLINIC_ANNUAL_PRICE_ID: 'price_clinic_year',
    };
    expect(parseServerConfig(source, 'billing').STRIPE_PRICE_PRO_MONTHLY).toBe('price_pro_month');
    expect(() => parseServerConfig({ ...source, STRIPE_PRICE_PRO_MONTHLY: 'price_other' }, 'billing')).toThrow('Conflicting configuration');
  });
});
