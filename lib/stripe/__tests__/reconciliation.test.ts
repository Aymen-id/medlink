// @vitest-environment node
import { beforeEach,expect,it,vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
const { stripe }=vi.hoisted(()=>({ stripe:{ prices:{ retrieve:vi.fn() },customers:{ create:vi.fn() },subscriptions:{ list:vi.fn() },checkout:{ sessions:{ create:vi.fn(),list:vi.fn(),expire:vi.fn() } },billingPortal:{ sessions:{ create:vi.fn() } } } }));
vi.mock('server-only',()=>({}));
vi.mock('../client',()=>({ getStripe:()=>stripe }));
import { reconcileStripeEvent,startBillingCheckout,preparePersonalBillingTransfer } from '../reconciliation';
const account={ id:'account',billing_admin_id:'owner',stripe_customer_id:'cus_test' };
const subscription={ id:'sub_current',customer:'cus_test',status:'active',items:{ data:[{ id:'si_test',price:{ id:'price_PRO_MONTHLY' },quantity:1,current_period_end:4070908800 }] } };
function database() {
  const receipts=new Set<string>(),snapshots:unknown[]=[];
  const query={ select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn() };
  let table='';const filters:Record<string,unknown>={};
  query.select.mockReturnValue(query);query.eq.mockImplementation((key:string,value:unknown)=>{ filters[key]=value;return query; });
  query.maybeSingle.mockImplementation(async()=>({ data:table==='stripe_webhook_events' ? (receipts.has(String(filters.event_id)) ? { event_id:filters.event_id }:null):account,error:null }));
  const rpc=vi.fn().mockImplementation(async(name:string,args:Record<string,unknown>)=>{ if(name==='apply_billing_snapshot') { receipts.add(String(args.event_id));snapshots.push(args.snapshot); }return { data:true,error:null }; });
  return { client:{ from:(name:string)=>{ table=name;return query; },rpc } as unknown as SupabaseClient,rpc,snapshots,receipts };
}
const event=(id:string,type='customer.subscription.updated')=>({ id,type,data:{ object:{ customer:'cus_test',status:'canceled' } },created:1 }) as unknown as Stripe.Event;
beforeEach(()=>{
  vi.clearAllMocks();vi.stubEnv('NEXT_PUBLIC_APP_URL','https://clinic.example');vi.stubEnv('STRIPE_SECRET_KEY','sk_test_example');vi.stubEnv('STRIPE_WEBHOOK_SECRET','whsec_example');
  for(const name of ['PRO_MONTHLY','PRO_ANNUAL','CLINIC_MONTHLY','CLINIC_ANNUAL']) vi.stubEnv(`STRIPE_PRICE_${name}`,`price_${name}`);
  stripe.subscriptions.list.mockResolvedValue({ data:[subscription],has_more:false });stripe.checkout.sessions.list.mockResolvedValue({ data:[],has_more:false });
  stripe.billingPortal.sessions.create.mockResolvedValue({ url:'https://billing.stripe.com/change' });stripe.checkout.sessions.create.mockResolvedValue({ url:'https://checkout.stripe.com/test' });
  stripe.prices.retrieve.mockImplementation(async(id:string)=>({ active:true,currency:'usd',unit_amount:id.includes('CLINIC') ? (id.includes('ANNUAL') ? 95040:9900):(id.includes('ANNUAL') ? 27840:2900),recurring:{ interval:id.includes('ANNUAL') ? 'year':'month',interval_count:1 } }));
});
it('rejects a configured price whose currency or annual amount differs from the approved plan',async()=>{
  const db=database();stripe.prices.retrieve.mockResolvedValue({ active:true,currency:'eur',unit_amount:2320,recurring:{ interval:'year',interval_count:1 } });
  await expect(startBillingCheckout(db.client,'account','owner@synthetic.test','pro','annual')).rejects.toThrow('price');
  expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
});
it('re-fetches canonical subscription state for old events and persists an event only once',async()=>{
  const db=database();await reconcileStripeEvent(db.client,event('evt_old'));await reconcileStripeEvent(db.client,event('evt_old'));
  expect(db.snapshots).toHaveLength(1);expect(db.snapshots[0]).toMatchObject({ subscriptionId:'sub_current',status:'active',tier:'pro' });
});
it('throws on persistence failure and can retry the same delivery',async()=>{
  const db=database();const original=db.rpc.getMockImplementation()!;let fail=true;
  db.rpc.mockImplementation(async(name:string,args:Record<string,unknown>)=>name==='apply_billing_snapshot' && fail ? { error:{ message:'Database unavailable' } }:original(name,args));
  await expect(reconcileStripeEvent(db.client,event('evt_retry'))).rejects.toThrow();expect(db.receipts.size).toBe(0);
  fail=false;await reconcileStripeEvent(db.client,event('evt_retry'));expect(db.receipts.has('evt_retry')).toBe(true);
});
it('uses the existing customer and updates the existing subscription through Portal confirmation',async()=>{
  const db=database();await startBillingCheckout(db.client,'account','owner@synthetic.test','clinic','annual');
  expect(stripe.customers.create).not.toHaveBeenCalled();expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ customer:'cus_test',flow_data:expect.objectContaining({ type:'subscription_update_confirm',subscription_update_confirm:{ subscription:'sub_current',items:[{ id:'si_test',price:'price_CLINIC_ANNUAL',quantity:1 }] } }) }));
});
it('reuses an open checkout instead of creating a duplicate subscription purchase',async()=>{
  const db=database();stripe.subscriptions.list.mockResolvedValue({ data:[],has_more:false });stripe.checkout.sessions.list.mockResolvedValue({ data:[{ id:'cs_open',url:'https://checkout.stripe.com/existing',metadata:{ billingAccountId:'account',priceId:'price_PRO_ANNUAL' } }],has_more:false });
  expect(await startBillingCheckout(db.client,'account','owner@synthetic.test','pro','annual')).toBe('https://checkout.stripe.com/existing');expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
});
it('does not grant an unknown price a paid tier',async()=>{
  const db=database();stripe.subscriptions.list.mockResolvedValue({ data:[{ ...subscription,items:{ data:[{ ...subscription.items.data[0],price:{ id:'unknown' } }] } }],has_more:false });
  await expect(reconcileStripeEvent(db.client,event('evt_unknown'))).rejects.toThrow();expect(db.snapshots).toHaveLength(0);
});
it('reconciles payment failure and cancellation from current Stripe status',async()=>{
  const db=database();stripe.subscriptions.list.mockResolvedValue({ data:[{ ...subscription,status:'past_due' }],has_more:false });
  await reconcileStripeEvent(db.client,event('evt_failed','invoice.payment_failed'));
  expect(db.snapshots[0]).toMatchObject({ status:'past_due' });
  stripe.subscriptions.list.mockResolvedValue({ data:[],has_more:false });
  await reconcileStripeEvent(db.client,event('evt_canceled','customer.subscription.deleted'));
  expect(db.snapshots[1]).toMatchObject({ tier:'free',subscriptionId:null });
});
it('refuses provider transfer while a canonical Stripe subscription is nonterminal',async()=>{
  const db=database();
  await expect(preparePersonalBillingTransfer(db.client,'owner')).rejects.toThrow(/subscription/i);
  expect(db.rpc.mock.calls.some(([name])=>name==='freeze_billing_for_transfer')).toBe(false);
});
it('expires open personal Checkout before durably freezing billing for provider transfer',async()=>{
  const db=database();stripe.subscriptions.list.mockResolvedValue({data:[],has_more:false});
  stripe.checkout.sessions.list.mockResolvedValue({data:[{id:'cs_pending'}],has_more:false});
  await preparePersonalBillingTransfer(db.client,'owner');
  expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_pending');
  expect(db.rpc).toHaveBeenCalledWith('freeze_billing_for_transfer',expect.objectContaining({account:'account'}));
});
it('does not mark billing transferable if an open Checkout cannot be expired',async()=>{
  const db=database();stripe.subscriptions.list.mockResolvedValue({data:[],has_more:false});
  stripe.checkout.sessions.list.mockResolvedValue({data:[{id:'cs_pending'}],has_more:false});
  stripe.checkout.sessions.expire.mockRejectedValueOnce(new Error('Checkout expiration failed'));
  await expect(preparePersonalBillingTransfer(db.client,'owner')).rejects.toThrow();
  expect(db.rpc.mock.calls.some(([name])=>name==='freeze_billing_for_transfer')).toBe(false);
});
