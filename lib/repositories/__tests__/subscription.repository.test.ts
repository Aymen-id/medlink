import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionRepository } from '../subscription.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

function createChainable() {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'insert', 'update', 'upsert', 'eq', 'single', 'maybeSingle'];
  for (const m of methods) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  return c;
}

function createMockSupabase() {
  const chainable = createChainable();
  const from = vi.fn().mockReturnValue(chainable);
  const supabase = { from } as unknown as SupabaseClient;
  return { supabase, from, chainable };
}

const USER_ID = '00000000-0000-0000-0000-000000000001';

const freeSubscriptionRow = {
  id: 'sub-001',
  user_id: USER_ID,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  tier: 'free',
  status: 'active',
  current_period_end: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const proSubscriptionRow = {
  ...freeSubscriptionRow,
  stripe_customer_id: 'cus_abc123',
  stripe_subscription_id: 'sub_abc123',
  tier: 'pro',
  current_period_end: '2099-02-01T00:00:00Z',
};


describe('SubscriptionRepository', () => {
  let mock: ReturnType<typeof createMockSupabase>;
  let repo: SubscriptionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = createMockSupabase();
    repo = new SubscriptionRepository(mock.supabase, USER_ID);
  });

  // ---- FIND BY USER ID ----
  describe('findByUserId', () => {
    it('should return the user subscription', async () => {
      mock.chainable.maybeSingle.mockResolvedValueOnce({
        data: proSubscriptionRow,
        error: null,
      });

      const result = await repo.findByUserId();

      expect(mock.from).toHaveBeenCalledWith('subscriptions');
      expect(mock.chainable.eq).toHaveBeenCalledWith('user_id', USER_ID);
      expect(result.data?.tier).toBe('pro');
      expect(result.data?.stripeCustomerId).toBe('cus_abc123');
      expect(result.error).toBeNull();
    });

    it('should return null when no subscription exists', async () => {
      mock.chainable.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await repo.findByUserId();

      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });

    it('should return error on database failure', async () => {
      mock.chainable.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Connection refused' },
      });

      const result = await repo.findByUserId();

      expect(result.data).toBeNull();
      expect(result.error).toBe('Connection refused');
    });
  });

  // ---- GET TIER ----
  describe('getTier', () => {
    it('does not grant paid access for canceled, past-due or expired subscriptions',async()=>{
      for(const row of [{ ...proSubscriptionRow,status:'canceled' },{ ...proSubscriptionRow,status:'past_due' },{ ...proSubscriptionRow,current_period_end:'2020-01-01T00:00:00Z' }]) {
        mock.chainable.maybeSingle.mockResolvedValueOnce({ data:row,error:null });
        expect(await repo.getTier()).toBe('free');
      }
    });
    it('should return "pro" for a pro subscriber', async () => {
      mock.chainable.maybeSingle.mockResolvedValueOnce({
        data: proSubscriptionRow,
        error: null,
      });

      const tier = await repo.getTier();

      expect(tier).toBe('pro');
    });

    it('should return "free" when no subscription exists', async () => {
      mock.chainable.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const tier = await repo.getTier();

      expect(tier).toBe('free');
    });

    it('should return "free" on database error', async () => {
      mock.chainable.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Error' },
      });

      const tier = await repo.getTier();

      expect(tier).toBe('free');
    });
  });

  // ---- CREATE OR UPDATE FROM STRIPE ----
  describe('createOrUpdateFromStripe', () => {
    it('should upsert subscription data from Stripe webhook', async () => {
      mock.chainable.single.mockResolvedValueOnce({
        data: proSubscriptionRow,
        error: null,
      });

      const result = await repo.createOrUpdateFromStripe({
        stripeCustomerId: 'cus_abc123',
        stripeSubscriptionId: 'sub_abc123',
        tier: 'pro',
        status: 'active',
        currentPeriodEnd: '2026-02-01T00:00:00Z',
      });

      expect(mock.from).toHaveBeenCalledWith('subscriptions');
      expect(mock.chainable.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER_ID,
          stripe_customer_id: 'cus_abc123',
          stripe_subscription_id: 'sub_abc123',
          tier: 'pro',
          status: 'active',
        }),
        { onConflict: 'user_id' },
      );
      expect(result.data?.tier).toBe('pro');
      expect(result.error).toBeNull();
    });

    it('should return error on upsert failure', async () => {
      mock.chainable.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Constraint violation' },
      });

      const result = await repo.createOrUpdateFromStripe({
        stripeCustomerId: 'cus_abc',
        stripeSubscriptionId: 'sub_abc',
        tier: 'pro',
        status: 'active',
        currentPeriodEnd: '2026-02-01T00:00:00Z',
      });

      expect(result.data).toBeNull();
      expect(result.error).toBe('Constraint violation');
    });
  });

  // ---- DOWNGRADE TO FREE ----
  describe('downgradeToFree', () => {
    it('should set tier to free and clear stripe fields', async () => {
      mock.chainable.single.mockResolvedValueOnce({
        data: { ...freeSubscriptionRow },
        error: null,
      });

      const result = await repo.downgradeToFree();

      expect(mock.chainable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'free',
          status: 'active',
          stripe_subscription_id: null,
          current_period_end: null,
        }),
      );
      expect(mock.chainable.eq).toHaveBeenCalledWith('user_id', USER_ID);
      expect(result.error).toBeNull();
    });
  });
});
