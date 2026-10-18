// @vitest-environment node
import { afterAll,beforeAll,expect,it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser,createTestDatabase,ids } from './harness';
let db:PGlite,account:string;
const token='90000000-0000-4000-8000-000000000001',otherToken='90000000-0000-4000-8000-000000000002';
beforeAll(async()=>{ db=await createTestDatabase();account=(await db.query<{ id:string }>('SELECT id FROM billing_accounts WHERE billing_admin_id=$1',[ids.owner])).rows[0].id; },120000);
afterAll(async()=>{ await db?.close(); });
it('serializes external billing operations with a renewable-expiry token',async()=>{
  expect((await db.query<{ acquired:boolean }>('SELECT acquire_billing_operation($1,$2) AS acquired',[account,token])).rows[0].acquired).toBe(true);
  expect((await db.query<{ acquired:boolean }>('SELECT acquire_billing_operation($1,$2) AS acquired',[account,otherToken])).rows[0].acquired).toBe(false);
  await expect(asUser(db,ids.owner,()=>db.query('SELECT acquire_billing_operation($1,$2)',[account,otherToken]))).rejects.toThrow();
});
it('persists state and event receipt together, and rejects a stale operation token',async()=>{
  await db.query('SELECT bind_billing_customer($1,$2,$3)',[account,token,'cus_synthetic']);
  const snapshot={ customerId:'cus_synthetic',subscriptionId:'sub_synthetic',tier:'pro',status:'active',periodEnd:'2099-01-01T00:00:00Z',interval:'annual',priceId:'price_pro_annual' };
  await expect(db.query('SELECT apply_billing_snapshot($1,$2,$3,$4)',[account,otherToken,'evt_failure',snapshot])).rejects.toThrow();
  expect((await db.query('SELECT * FROM stripe_webhook_events')).rows).toHaveLength(0);
  await db.query('SELECT apply_billing_snapshot($1,$2,$3,$4)',[account,token,'evt_one',snapshot]);
  expect((await db.query('SELECT tier FROM subscriptions WHERE billing_account_id=$1',[account])).rows[0]).toEqual({ tier:'pro' });
  expect((await db.query('SELECT event_id FROM stripe_webhook_events')).rows).toEqual([{ event_id:'evt_one' }]);
  // A replay cannot change the same event into another state.
  await db.query('SELECT apply_billing_snapshot($1,$2,$3,$4)',[account,token,'evt_one',{ ...snapshot,tier:'clinic' }]);
  expect((await db.query('SELECT tier FROM subscriptions WHERE billing_account_id=$1',[account])).rows[0]).toEqual({ tier:'pro' });
});
