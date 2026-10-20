// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDatabase, ids } from './harness';

describe('additive workspace migration on PostgreSQL', () => {
  let db: PGlite;
  beforeAll(async () => { db = await createTestDatabase(); }, 120_000);
  afterAll(async () => { await db?.close(); });

  it('backfills existing profiles, owners and staff without moving patient records', async () => {
    expect((await db.query('SELECT id FROM physician_workspaces')).rows).toHaveLength(4);
    const memberships = await db.query('SELECT * FROM workspace_memberships WHERE workspace_id=$1', [ids.owner]);
    expect(memberships.rows).toHaveLength(3);
    expect((await db.query('SELECT owner_id FROM patients WHERE id=$1', [ids.patient])).rows).toEqual([{ owner_id: ids.owner }]);
  });

  it('keeps personal and invited memberships visible to the same user', async () => {
    const result = await asUser(db, ids.editor, () => db.query('SELECT workspace_id FROM workspace_memberships WHERE user_id=$1', [ids.editor]));
    expect(result.rows).toHaveLength(2);
  });

  it('creates a private workspace and billing account for new physician signups', async () => {
    const id = '00000000-0000-4000-8000-000000000005';
    await db.query("INSERT INTO auth.users(id,email) VALUES ($1,'new@synthetic.test')", [id]);
    expect((await db.query('SELECT owner_user_id FROM physician_workspaces WHERE id=$1', [id])).rows).toEqual([{ owner_user_id: id }]);
    expect((await db.query("SELECT user_id FROM workspace_memberships WHERE workspace_id=$1 AND role='owner'", [id])).rows).toEqual([{ user_id: id }]);
  });

  it('does not let billing administration alone grant patient membership', async () => {
    const account = await db.query<{ id: string }>('SELECT id FROM billing_accounts WHERE billing_admin_id=$1', [ids.outsider]);
    await db.query('UPDATE physician_workspaces SET billing_account_id=$1 WHERE id=$2', [account.rows[0].id, ids.owner]);
    const result = await asUser(db, ids.outsider, () => db.query('SELECT user_id FROM workspace_memberships WHERE workspace_id=$1', [ids.owner]));
    expect(result.rows).toEqual([]);
  });
});
