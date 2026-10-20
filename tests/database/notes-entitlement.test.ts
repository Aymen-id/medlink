// @vitest-environment node
import { afterAll,beforeAll,expect,it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser,createTestDatabase,ids } from './harness';
let db:PGlite;
beforeAll(async()=>{ db=await createTestDatabase(); },120000);
afterAll(async()=>{ await db?.close(); });
it('blocks new Free notes and permits Pro notes using the workspace billing account',async()=>{
  await db.query("UPDATE subscriptions SET tier='free' WHERE user_id=$1",[ids.owner]);
  await expect(asUser(db,ids.owner,()=>db.query("INSERT INTO appointment_notes(patient_id,author_id,content) VALUES ($1,$2,'Free bypass')",[ids.patient,ids.owner]))).rejects.toThrow();
  await db.query("UPDATE subscriptions SET tier='pro' WHERE user_id=$1",[ids.owner]);
  expect((await asUser(db,ids.owner,()=>db.query("INSERT INTO appointment_notes(patient_id,author_id,content) VALUES ($1,$2,'Pro note') RETURNING id",[ids.patient,ids.owner]))).rows).toHaveLength(1);
});
it('retains historical read access after downgrade while blocking edits and expired paid status',async()=>{
  await db.query("UPDATE subscriptions SET tier='pro',status='canceled' WHERE user_id=$1",[ids.owner]);
  expect((await asUser(db,ids.owner,()=>db.query('SELECT * FROM appointment_notes'))).rows).toHaveLength(1);
  expect((await asUser(db,ids.owner,()=>db.query("UPDATE appointment_notes SET content='bypass' RETURNING id"))).rows).toHaveLength(0);
});
