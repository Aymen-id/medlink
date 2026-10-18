// @vitest-environment node
import { expect,it,vi } from 'vitest';
import { NextRequest } from 'next/server';
const { reconcile,construct }=vi.hoisted(()=>({ reconcile:vi.fn(),construct:vi.fn() }));
vi.mock('@/lib/stripe/client',()=>({ getStripe:()=>({ webhooks:{ constructEvent:construct } }) }));
vi.mock('@/lib/config/server',()=>({ getServerConfig:()=>({ STRIPE_WEBHOOK_SECRET:'synthetic' }) }));
vi.mock('@/lib/supabase/admin',()=>({ createAdminClient:()=>({}) }));
vi.mock('@/lib/stripe/reconciliation',()=>({ reconcileStripeEvent:reconcile }));
import { POST } from '../route';
it('returns retryable failure when persistence fails after a valid signature',async()=>{
  construct.mockReturnValue({ id:'evt_retry' });reconcile.mockRejectedValue(new Error('Database unavailable'));
  const response=await POST(new NextRequest('https://clinic.example/api/webhooks/stripe',{ method:'POST',headers:{ 'stripe-signature':'synthetic' },body:'{}' }));
  expect(response.status).toBe(503);expect(reconcile).toHaveBeenCalled();
});
