import { beforeEach, describe, expect, it, vi } from 'vitest';
const { createCheckout, createPortal,expireCheckout } = vi.hoisted(() => ({
  createCheckout: vi.fn(), createPortal: vi.fn(),expireCheckout:vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('../client', () => ({ getStripe: () => ({
  checkout: { sessions: { create: createCheckout,expire:expireCheckout } },
  billingPortal: { sessions: { create: createPortal } },
}) }));
import { createCheckoutSession, createPortalSession } from '../checkout';

describe('billing origin configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://clinic.example');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_example');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_example');
    for (const name of ['PRO_MONTHLY', 'PRO_ANNUAL', 'CLINIC_MONTHLY', 'CLINIC_ANNUAL']) {
      vi.stubEnv(`STRIPE_PRICE_${name}`, `price_${name}`);
    }
    createCheckout.mockResolvedValue({ url: 'https://checkout.stripe.com/synthetic' });
    createPortal.mockResolvedValue({ url: 'https://billing.stripe.com/synthetic' });
    expireCheckout.mockResolvedValue({id:'cs_unissued',status:'expired'});
  });

  it('uses the configured origin for checkout and portal return URLs', async () => {
    await createCheckoutSession('account-1', 'cus_synthetic', 'pro', 'monthly','attempt-1');
    expect(createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      success_url: 'https://clinic.example/settings/billing?success=true',
      cancel_url: 'https://clinic.example/settings/billing?canceled=true',
    }),expect.objectContaining({ idempotencyKey:'medilink-checkout:account-1:attempt-1' }));
    await createPortalSession('cus_synthetic');
    expect(createPortal).toHaveBeenCalledWith(expect.objectContaining({ return_url: 'https://clinic.example/settings/billing' }));
  });

  it('does not call Stripe when the application origin is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    await expect(createCheckoutSession('account-1', 'cus_synthetic', 'pro', 'monthly','attempt-1')).rejects.toThrow('NEXT_PUBLIC_APP_URL');
    expect(createCheckout).not.toHaveBeenCalled();
  });
  it('expires an unissued Checkout instead of returning its URL after losing billing eligibility',async()=>{
    createCheckout.mockResolvedValue({id:'cs_unissued',url:'https://checkout.stripe.com/synthetic'});
    await expect(createCheckoutSession('account-1','cus_synthetic','pro','monthly','attempt-1',async()=>{throw new Error('Billing transferred');})).rejects.toThrow('Billing transferred');
    expect(expireCheckout).toHaveBeenCalledWith('cs_unissued');
  });
});
