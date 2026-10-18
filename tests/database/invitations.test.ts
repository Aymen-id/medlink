// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDatabase, ids } from './harness';

describe('Clinic invitations and reserved provider seats', () => {
  let db: PGlite; let account: string;
  beforeAll(async () => {
    db = await createTestDatabase();
    account = (await db.query<{ id: string }>('SELECT id FROM billing_accounts WHERE billing_admin_id=$1', [ids.owner])).rows[0].id;
  }, 120_000);
  afterAll(async () => { await db?.close(); });
  const invite = (email: string, kind = 'provider') => asUser(db, ids.owner, () => db.query<{ id: string }>(
    "SELECT create_team_invitation($1,$2,$3,$4,'assistant','view') AS id", [account, ids.owner, email, kind]));

  it('requires the invited, confirmed email and grants a staff membership only on acceptance', async () => {
    const email = 'staff-new@synthetic.test';
    const user = '00000000-0000-4000-8000-000000000006';
    await db.query('INSERT INTO auth.users(id,email) VALUES ($1,$2)', [user,email]);
    const id = (await invite(email,'staff')).rows[0].id;
    expect((await db.query('SELECT user_id FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2', [ids.owner,user])).rows).toHaveLength(0);
    await expect(asUser(db, ids.outsider, () => db.query('SELECT accept_team_invitation($1)', [id]))).rejects.toThrow();
    await asUser(db,user, () => db.query('SELECT accept_team_invitation($1)', [id]));
    expect((await db.query('SELECT permissions FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2', [ids.owner,user])).rows).toEqual([{ permissions:'view' }]);
  });

  it('counts pending provider reservations toward the eight workspace limit', async () => {
    const settled = await Promise.allSettled(Array.from({ length: 8 }, (_, index) => invite(`provider-${index}@synthetic.test`)));
    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(7);
    expect(settled.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await db.query("SELECT id FROM team_invitations WHERE kind='provider' AND status='pending' AND billing_account_id=$1", [account])).rows).toHaveLength(7);
  });

  it('joins a physician workspace without granting billing admin patient access', async () => {
    const user = '00000000-0000-4000-8000-000000000007';
    await db.query("INSERT INTO auth.users(id,email) VALUES ($1,'provider-0@synthetic.test')", [user]);
    const invitation = (await db.query<{ id: string }>("SELECT id FROM team_invitations WHERE invited_email='provider-0@synthetic.test'")).rows[0].id;
    await asUser(db,user, () => db.query('SELECT accept_team_invitation($1)', [invitation]));
    expect((await db.query('SELECT billing_account_id FROM physician_workspaces WHERE id=$1', [user])).rows).toEqual([{ billing_account_id:account }]);
    expect((await db.query('SELECT user_id FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2', [user,ids.owner])).rows).toHaveLength(0);
  });

  it('keeps legacy staff updates and revocations synchronized with membership', async () => {
    await asUser(db,ids.owner, () => db.query("UPDATE staff_access SET permissions='view' WHERE owner_id=$1 AND staff_user_id=$2", [ids.owner,ids.editor]));
    expect((await db.query('SELECT permissions FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2', [ids.owner,ids.editor])).rows).toEqual([{ permissions:'view' }]);
    await asUser(db,ids.owner, () => db.query('DELETE FROM staff_access WHERE owner_id=$1 AND staff_user_id=$2', [ids.owner,ids.editor]));
    expect((await db.query('SELECT user_id FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2', [ids.owner,ids.editor])).rows).toHaveLength(0);
  });

  it('does not extend Pro entitlement to additional Clinic provider workspaces after downgrade',async()=>{
    const provider='00000000-0000-4000-8000-000000000007';
    await db.query("UPDATE subscriptions SET tier='pro' WHERE billing_account_id=$1",[account]);
    try {
      expect((await asUser(db,ids.owner,()=>db.query<{ tier:string }>('SELECT get_workspace_tier($1) AS tier',[ids.owner]))).rows[0].tier).toBe('pro');
      expect((await asUser(db,provider,()=>db.query<{ tier:string }>('SELECT get_workspace_tier($1) AS tier',[provider]))).rows[0].tier).toBe('free');
      expect((await db.query<{billing_account_id:string}>('SELECT billing_account_id FROM physician_workspaces WHERE id=$1',[provider])).rows[0].billing_account_id).not.toBe(account);
    } finally {
      await db.query("UPDATE subscriptions SET tier='clinic' WHERE billing_account_id=$1",[account]);
      // Restore this shared fixture so the independent explicit-removal case runs.
      await db.query('UPDATE physician_workspaces SET billing_account_id=$1 WHERE id=$2',[account,provider]);
    }
  });

  it('blocks provider transfer during a personal billing operation or unresolved Stripe customer',async()=>{
    const provider='00000000-0000-4000-8000-000000000008';
    const token='90000000-0000-4000-8000-000000000008';
    await db.query("INSERT INTO auth.users(id,email) VALUES ($1,'provider-1@synthetic.test')",[provider]);
    const personal=(await db.query<{ id:string }>('SELECT id FROM billing_accounts WHERE billing_admin_id=$1',[provider])).rows[0].id;
    const invitation=(await db.query<{ id:string }>("SELECT id FROM team_invitations WHERE invited_email='provider-1@synthetic.test'")).rows[0].id;
    await db.query('SELECT acquire_billing_operation($1,$2)',[personal,token]);
    await expect(asUser(db,provider,()=>db.query('SELECT accept_team_invitation($1)',[invitation]))).rejects.toThrow(/billing/i);
    await db.query('SELECT bind_billing_customer($1,$2,$3)',[personal,token,'cus_transfer_synthetic']);
    await db.query('SELECT release_billing_operation($1,$2)',[personal,token]);
    await expect(asUser(db,provider,()=>db.query('SELECT accept_team_invitation($1)',[invitation]))).rejects.toThrow(/billing/i);
    expect((await db.query('SELECT billing_account_id FROM physician_workspaces WHERE id=$1',[provider])).rows[0]).toEqual({billing_account_id:personal});
    await db.query('SELECT acquire_billing_operation($1,$2)',[personal,token]);
    await expect(asUser(db,provider,()=>db.query('SELECT freeze_billing_for_transfer($1,$2)',[personal,token]))).rejects.toThrow();
    await db.query('SELECT freeze_billing_for_transfer($1,$2)',[personal,token]);
    await db.query('SELECT release_billing_operation($1,$2)',[personal,token]);
    await asUser(db,provider,()=>db.query('SELECT accept_team_invitation($1)',[invitation]));
    await db.query('SELECT unfreeze_personal_billing($1)',[provider]);
    await db.query('SELECT acquire_billing_operation($1,$2)',[personal,token]);
    await expect(db.query('SELECT assert_billing_purchase_allowed($1,$2)',[personal,token])).rejects.toThrow(/billing/i);
    await db.query('SELECT release_billing_operation($1,$2)',[personal,token]);
  });

  it('can remove a provider from billing without changing their record ownership', async () => {
    const provider='00000000-0000-4000-8000-000000000007';
    await asUser(db,ids.owner, () => db.query('SELECT remove_clinic_provider($1,$2)',[account,provider]));
    expect((await db.query('SELECT owner_user_id FROM physician_workspaces WHERE id=$1 AND billing_account_id<>$2',[provider,account])).rows).toEqual([{ owner_user_id:provider }]);
  });
});
