import type { SupabaseClient } from '@supabase/supabase-js';
import type { Subscription, SubscriptionTier } from '@/types';
import type { ApiResponse } from '@/types/api';

type SubscriptionRow = {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tier: string;
  status: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
  billing_interval?:'monthly' | 'annual' | null;
};

type StripeData = {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  tier: SubscriptionTier;
  status: string;
  currentPeriodEnd: string;
};

function mapRowToSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    stripeCustomerId: row.stripe_customer_id ?? '',
    stripeSubscriptionId: row.stripe_subscription_id ?? '',
    tier: row.tier as SubscriptionTier,
    status: row.status,
    currentPeriodEnd: row.current_period_end ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    billingInterval:row.billing_interval ?? null,
  };
}

export class SubscriptionRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly userId: string,
    private readonly billingAccountId?:string,
  ) {}

  /**
   * Fetches the user's current subscription.
   */
  async findByUserId(): Promise<ApiResponse<Subscription>> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select()
      .eq(this.billingAccountId ? 'billing_account_id':'user_id', this.billingAccountId ?? this.userId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: null };
    return { data: mapRowToSubscription(data as SubscriptionRow), error: null };
  }

  /**
   * Returns the user's current tier. Defaults to 'free' if no subscription exists.
   */
  async getTier(): Promise<SubscriptionTier> {
    const { data } = await this.findByUserId();
    if(!data || !['active','trialing'].includes(data.status) || (data.currentPeriodEnd && Date.parse(data.currentPeriodEnd)<=Date.now())) return 'free';
    return data.tier;
  }

  /**
   * Creates or updates a subscription from Stripe webhook data.
   * Upserts on user_id (unique constraint).
   */
  async createOrUpdateFromStripe(stripeData: StripeData): Promise<ApiResponse<Subscription>> {
    const row = {
      user_id: this.userId,
      stripe_customer_id: stripeData.stripeCustomerId,
      stripe_subscription_id: stripeData.stripeSubscriptionId,
      tier: stripeData.tier,
      status: stripeData.status,
      current_period_end: stripeData.currentPeriodEnd,
    };

    const { data, error } = await this.supabase
      .from('subscriptions')
      .upsert(row, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRowToSubscription(data as SubscriptionRow), error: null };
  }

  /**
   * Downgrades user to free tier (clears Stripe subscription fields).
   */
  async downgradeToFree(): Promise<ApiResponse<Subscription>> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .update({
        tier: 'free',
        status: 'active',
        stripe_subscription_id: null,
        current_period_end: null,
      })
      .eq('user_id', this.userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRowToSubscription(data as SubscriptionRow), error: null };
  }
}
