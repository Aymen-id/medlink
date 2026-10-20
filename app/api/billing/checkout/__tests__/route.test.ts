// @vitest-environment node
import { expect,it,vi } from 'vitest';
import { NextRequest } from 'next/server';
const { checkout }=vi.hoisted(()=>({ checkout:vi.fn().mockResolvedValue('https://checkout.stripe.com/test') }));
vi.mock('@/lib/supabase/context',()=>({ getUserContext:async()=>({ userId:'provider',ownerId:'provider',billingAccountId:'clinic-account' }) }));
vi.mock('@/lib/supabase/server',()=>({ createClient:async()=>{
  const chain={ select:()=>chain,eq:()=>chain,maybeSingle:async()=>({ data:null,error:null }) };
  return { from:()=>chain,auth:{ getUser:async()=>({ data:{ user:{ email:'provider@synthetic.test' } } }) } };
} }));
vi.mock('@/lib/supabase/admin',()=>({ createAdminClient:()=>({}) }));
vi.mock('@/lib/repositories/subscription.repository',()=>({ SubscriptionRepository:class { getTier=async()=> 'free'; } }));
vi.mock('@/lib/stripe/checkout',()=>({ createCheckoutSession:checkout }));
vi.mock('@/lib/stripe/reconciliation',()=>({ startBillingCheckout:checkout }));
import { POST } from '../route';
it('denies billing changes to a provider who is not the account billing admin',async()=>{
  const result=await POST(new NextRequest('https://clinic.example/api/billing/checkout',{ method:'POST',body:JSON.stringify({ tier:'clinic',billingInterval:'annual' }) }));
  expect(result.status).toBe(403);expect(checkout).not.toHaveBeenCalled();
});
it('returns a validation response for malformed JSON',async()=>{
  const result=await POST(new NextRequest('https://clinic.example/api/billing/checkout',{ method:'POST',body:'{' }));
  expect(result.status).toBe(400);
});
