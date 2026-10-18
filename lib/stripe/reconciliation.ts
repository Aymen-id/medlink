import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { z } from 'zod';
import { getStripe } from './client';
import { getStripePrices } from './prices';
import { createCheckoutSession,createPortalSession } from './checkout';
import { getAppOrigin } from '@/lib/config/public';
import type { SubscriptionTier } from '@/types';
import type { BillingInterval } from './config';
import { TIER_PRICING } from '@/lib/constants';

const accountSchema=z.object({ id:z.string(),billing_admin_id:z.string(),stripe_customer_id:z.string().nullable() });
async function accountById(admin:SupabaseClient,id:string) {
  const { data,error }=await admin.from('billing_accounts').select('id,billing_admin_id,stripe_customer_id').eq('id',id).maybeSingle();
  if(error) throw new Error('Could not read billing account');
  return accountSchema.parse(data);
}
async function withOperation<T>(admin:SupabaseClient,account:string,operation:(token:string)=>Promise<T>) {
  const token=randomUUID();
  const lease=await admin.rpc('acquire_billing_operation',{ account,token });
  if(lease.error || lease.data!==true) throw new Error('Billing is busy. Please retry shortly.');
  try { return await operation(token); }
  finally { await admin.rpc('release_billing_operation',{ account,token }); }
}
async function currentSubscription(customer:string):Promise<Stripe.Subscription | null> {
  const result=await getStripe().subscriptions.list({ customer,status:'all',limit:100 });
  if(result.has_more) throw new Error('Billing history requires reconciliation before another purchase');
  const active=result.data.filter(subscription=>!['canceled','incomplete_expired'].includes(subscription.status));
  if(active.length>1) throw new Error('Multiple subscriptions require billing reconciliation');
  return active[0] ?? null;
}
function priceDetails(priceId:string) {
  const prices=getStripePrices();
  for(const tier of ['pro','clinic'] as const) for(const interval of ['monthly','annual'] as const) {
    if(prices[tier][interval]===priceId) return { tier,interval };
  }
  throw new Error('Unrecognized subscription price; paid access was not inferred');
}
export async function startBillingCheckout(admin:SupabaseClient,accountId:string,email:string,tier:Exclude<SubscriptionTier,'free'>,interval:BillingInterval):Promise<string> {
  getAppOrigin();
  const priceId=getStripePrices()[tier][interval];
  const price=await getStripe().prices.retrieve(priceId);
  if(!price.active || price.currency!=='usd' || price.unit_amount!==Math.round(TIER_PRICING[tier][interval]*100) || price.recurring?.interval!==(interval==='annual' ? 'year':'month') || price.recurring.interval_count!==1) {
    throw new Error('Configured Stripe price does not match the approved USD plan amount and interval');
  }
  return withOperation(admin,accountId,async token=>{
    const renew=async()=>{
      const result=await admin.rpc('acquire_billing_operation',{account:accountId,token});
      if(result.error || result.data!==true) throw new Error('Billing operation expired; retry safely');
      const allowed=await admin.rpc('assert_billing_purchase_allowed',{account:accountId,token});
      if(allowed.error) throw new Error('Personal billing is closed for Clinic transfer or workspace ownership changed');
    };
    const account=await accountById(admin,accountId);
    const allowed=await admin.rpc('assert_billing_purchase_allowed',{account:accountId,token});
    if(allowed.error) throw new Error('Personal billing is closed for Clinic transfer or workspace ownership changed');
    let customer=account.stripe_customer_id;
    if(!customer) {
      const created=await getStripe().customers.create({ email,metadata:{ billingAccountId:accountId } },{ idempotencyKey:`medilink-customer:${accountId}` });
      customer=created.id;
      const bound=await admin.rpc('bind_billing_customer',{ account:accountId,token,customer });
      if(bound.error) throw new Error('Could not persist billing customer; retry safely');
    }
    const existing=await currentSubscription(customer);
    if(existing) {
      if(existing.items.data.length!==1) throw new Error('Subscription items require reconciliation');
      return createPortalSession(customer,{ subscriptionId:existing.id,itemId:existing.items.data[0].id,priceId });
    }
    const sessions=await getStripe().checkout.sessions.list({ customer,status:'open',limit:100 });
    if(sessions.has_more) throw new Error('Open checkout history requires reconciliation');
    let reusable:Stripe.Checkout.Session | undefined;
    for(const session of sessions.data) {
      if(!reusable && session.metadata?.billingAccountId===accountId && session.metadata?.priceId===priceId && session.url) reusable=session;
      else { await renew();await getStripe().checkout.sessions.expire(session.id); }
    }
    if(reusable?.url) {await renew();return reusable.url;}
    await renew();return createCheckoutSession(accountId,customer,tier,interval,token,renew);
  });
}
/** Close external purchase paths before the authenticated invitation RPC moves a workspace. */
export async function preparePersonalBillingTransfer(admin:SupabaseClient,userId:string):Promise<void> {
  const result=await admin.from('billing_accounts').select('id,billing_admin_id,stripe_customer_id').eq('billing_admin_id',userId).maybeSingle();
  if(result.error) throw new Error('Could not verify personal billing account');
  const account=accountSchema.parse(result.data);
  await withOperation(admin,account.id,async token=>{
    if(account.stripe_customer_id) {
      if(await currentSubscription(account.stripe_customer_id)) throw new Error('Resolve the existing personal subscription before joining this Clinic');
      const sessions=await getStripe().checkout.sessions.list({customer:account.stripe_customer_id,status:'open',limit:100});
      if(sessions.has_more) throw new Error('Open Checkout history requires billing reconciliation');
      for(const session of sessions.data) {
        const renewed=await admin.rpc('acquire_billing_operation',{account:account.id,token});
        if(renewed.error || renewed.data!==true) throw new Error('Personal billing operation expired; retry safely');
        await getStripe().checkout.sessions.expire(session.id);
      }
      // Checkout might have completed just before the list. Never freeze if
      // canonical Stripe state now contains a nonterminal obligation.
      if(await currentSubscription(account.stripe_customer_id)) throw new Error('Resolve the existing personal subscription before joining this Clinic');
    }
    const frozen=await admin.rpc('freeze_billing_for_transfer',{account:account.id,token});
    if(frozen.error) throw new Error('Could not close personal billing for Clinic transfer; retry safely');
  });
}
export async function reconcileStripeEvent(admin:SupabaseClient,event:Stripe.Event):Promise<void> {
  if(!event.type.startsWith('customer.subscription.') && !['checkout.session.completed','checkout.session.async_payment_succeeded','invoice.paid','invoice.payment_failed'].includes(event.type)) return;
  const receipt=await admin.from('stripe_webhook_events').select('event_id').eq('event_id',event.id).maybeSingle();
  if(receipt.error) throw new Error('Could not check webhook receipt');
  if(receipt.data) return;
  const parsed=z.object({ customer:z.union([z.string(),z.object({ id:z.string() })]).nullable() }).safeParse(event.data.object);
  if(!parsed.success || !parsed.data.customer) throw new Error('Billing event has no customer');
  const customer=typeof parsed.data.customer==='string' ? parsed.data.customer:parsed.data.customer.id;
  const accountResult=await admin.from('billing_accounts').select('id,billing_admin_id,stripe_customer_id').eq('stripe_customer_id',customer).maybeSingle();
  if(accountResult.error) throw new Error('Could not find webhook billing account');
  if(!accountResult.data) return; // This Stripe account can also serve unrelated products.
  const account=accountSchema.parse(accountResult.data);
  await withOperation(admin,account.id,async token=>{
    // Fetch only after acquiring the account lease. Event delivery order is irrelevant.
    const subscription=await currentSubscription(customer);
    let snapshot:{ customerId:string;subscriptionId:string | null;tier:SubscriptionTier;status:string;periodEnd:string | null;interval:BillingInterval | null;priceId:string | null }={ customerId:customer,subscriptionId:null,tier:'free',status:'active',periodEnd:null,interval:null,priceId:null };
    if(subscription) {
      if(subscription.items.data.length!==1) throw new Error('Subscription items require reconciliation');
      const item=subscription.items.data[0],priceId=item.price.id;
      const details=priceDetails(priceId);
      snapshot={ customerId:customer,subscriptionId:subscription.id,...details,status:subscription.status,periodEnd:new Date(item.current_period_end*1000).toISOString(),priceId };
    }
    const applied=await admin.rpc('apply_billing_snapshot',{ account:account.id,token,event_id:event.id,snapshot });
    if(applied.error) throw new Error('Could not persist subscription and webhook receipt; delivery must retry');
  });
}
